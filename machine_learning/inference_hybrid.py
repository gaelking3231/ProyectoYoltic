import os
import json
import asyncio
import websockets
import base64
import uuid
from datetime import datetime
from aiohttp import web
import time
import wave
import audioop
import numpy as np
import soundfile as sf
from dotenv import load_dotenv

# Carpeta para guardar audios de entrenamiento
SAVE_DIR = "/home/site/wwwroot/training_data" if os.environ.get("PORT") else "training_data"
os.makedirs(SAVE_DIR, exist_ok=True)

# Cargar variables de entorno (OpenAI API, Anthropic API) desde dashboard/.env.local
env_path = os.path.join(os.path.dirname(__file__), "..", "dashboard", ".env.local")
load_dotenv(env_path)

import azure.cognitiveservices.speech as speechsdk
from anthropic import Anthropic
from openai import OpenAI
import firebase_admin
from firebase_admin import credentials, firestore, storage
import uuid

openai_client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))
anthropic_client = Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))

# Azure Config
azure_speech_key = os.environ.get("AZURE_SPEECH_KEY")
azure_speech_region = os.environ.get("AZURE_SPEECH_REGION")
azure_speech_config = None
if azure_speech_key and azure_speech_region:
    azure_speech_config = speechsdk.SpeechConfig(subscription=azure_speech_key, region=azure_speech_region)
    azure_speech_config.speech_synthesis_voice_name = "es-MX-JorgeNeural" # Voz masculina clara para los lentes


# ==========================================
# FIRESTORE DASHBOARD SYNC (TAREA 3)
# ==========================================
db = None
try:
    if not firebase_admin._apps:
        # Intenta cargar desde variable de entorno (Azure/Producción) o desde archivo local
        firebase_json = os.environ.get("FIREBASE_SERVICE_ACCOUNT_JSON")
        if firebase_json:
            print("Cargando credenciales de Firebase desde Variable de Entorno")
            cred_dict = json.loads(firebase_json)
            cred = credentials.Certificate(cred_dict)
        else:
            print("Buscando serviceAccountKey.json localmente...")
            cred_path = os.path.join(os.path.dirname(__file__), "..", "dashboard", "serviceAccountKey.json")
            cred = credentials.Certificate(cred_path)
            
        firebase_admin.initialize_app(cred, {
            'storageBucket': os.environ.get("NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET", 'proyectoyoltic.firebasestorage.app')
        })
    db = firestore.client()
    print("Sincronización con Firebase y Storage Activa")
except Exception as e:
    print(f"Aviso: Firebase funcionando en modo limitado o local. Razón: {e}")


# ==========================================
# MODELOS LOCALES CTRANSLATE2
# ==========================================
try:
    import ctranslate2
    import transformers
    CT2_AVAILABLE = True
except ImportError:
    CT2_AVAILABLE = False
    print("⚠️ Faltan librerías locales (ctranslate2, transformers).")

BASE_DIR = os.path.dirname(__file__)
WHISPER_CT2_PATH = os.path.join(BASE_DIR, "whisper_ct2")
NLLB_CT2_PATH = os.path.join(BASE_DIR, "nllb_ct2")

whisper_model = None
whisper_processor = None
nllb_model = None
nllb_tokenizer = None

def init_local_models():
    global whisper_model, whisper_processor, nllb_model, nllb_tokenizer
    if CT2_AVAILABLE and os.path.exists(WHISPER_CT2_PATH) and os.path.exists(NLLB_CT2_PATH):
        print("🚀 Inicializando modelos locales CTranslate2 (INT8)...")
        whisper_model = ctranslate2.models.Whisper(WHISPER_CT2_PATH, device="auto", compute_type="int8")
        whisper_processor = transformers.WhisperProcessor.from_pretrained("openai/whisper-small")
        
        nllb_model = ctranslate2.Translator(NLLB_CT2_PATH, device="auto", compute_type="int8")
        nllb_tokenizer = transformers.AutoTokenizer.from_pretrained("facebook/nllb-200-distilled-600M")
        return True
    return False

LOCAL_READY = init_local_models()

# ==========================================
# LÓGICA DE INFERENCIA
# ==========================================
def run_local_inference(audio_np):
    # 1. STT Whisper Local
    features = whisper_processor(audio_np, return_tensors="np", sampling_rate=16000)
    features_ct2 = ctranslate2.StorageView.from_array(features.input_features)
    # CTranslate2 Whisper usa los tokens directamente como strings
    results = whisper_model.generate(features_ct2, [["<|startoftranscript|>", "<|es|>", "<|transcribe|>", "<|notimestamps|>"]])
    stt_text = whisper_processor.decode(results[0].sequences_ids[0], skip_special_tokens=True, clean_up_tokenization_spaces=False).strip()
    
    # 2. Traducción NLLB Local
    tokens = nllb_tokenizer.convert_ids_to_tokens(nllb_tokenizer.encode(stt_text))
    # NLLB CTranslate2 espera target_prefix como string
    results_nllb = nllb_model.translate_batch([tokens], target_prefix=[["spa_Latn"]])
    translation = nllb_tokenizer.decode(results_nllb[0].hypotheses[0], skip_special_tokens=True, clean_up_tokenization_spaces=False).strip()
    return stt_text, translation

def run_cloud_inference(wav_path):
    # 1. STT Whisper API (Forzamos español para evitar alucinaciones en coreano/japonés)
    with open(wav_path, "rb") as audio_file:
        transcript = openai_client.audio.transcriptions.create(
            model="whisper-1", 
            file=audio_file,
            temperature=0.2,
            prompt="Padiuxhi, Sicarú siadó', Sicarú huadxí, Sicarú gueela', Ximodo nuu lu', Xquixe pe', Zapoteco del Istmo"
        )
    stt_text = transcript.text.strip()
    
    # Filtro contra alucinaciones conocidas de Whisper en silencio/ruido
    lower_stt = stt_text.lower()
    if "amara.org" in lower_stt or "subtítulos" in lower_stt or "suscríbete" in lower_stt or stt_text == "":
        stt_text = "..."
    
    # 2. Traducción Claude API (Bidireccional con Diccionario Base)
    claude_msg = anthropic_client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=50,
        system="Eres un traductor bilingüe experto en Zapoteco del Istmo y Español. Si el texto de entrada está en Español, tradúcelo al Zapoteco del Istmo. Si el texto está en Zapoteco, tradúcelo al Español. Devuelve SOLO la traducción directa.\n\nDICCIONARIO BÁSICO:\n- Padiuxhi / Padiuxi = Hola / Buenos días\n- Sicarú siadó' = Buenos días\n- Sicarú huadxí = Buenas tardes\n- Ximodo nuu lu' = ¿Cómo estás?\n- Xquixe pe' = Gracias\n- Nda / Ola = Hola",
        messages=[{"role": "user", "content": stt_text}]
    )
    return stt_text, claude_msg.content[0].text.strip()

def generate_azure_tts(text):
    """Genera audio PCM de alta calidad usando Azure Neural TTS"""
    if not azure_speech_config:
        return None
    
    # Crear un sintetizador en memoria
    pull_stream = speechsdk.audio.PullAudioOutputStream()
    stream_config = speechsdk.audio.AudioOutputConfig(stream=pull_stream)
    
    # Configurar formato a 16kHz Mono (Igual que el ESP32)
    azure_speech_config.set_speech_synthesis_output_format(speechsdk.SpeechSynthesisOutputFormat.Raw16Khz16BitMonoPcm)
    
    synthesizer = speechsdk.SpeechSynthesizer(speech_config=azure_speech_config, audio_config=stream_config)
    result = synthesizer.speak_text_async(text).get()
    
    if result.reason == speechsdk.ResultReason.SynthesizingAudioCompleted:
        return result.audio_data
    return None


# ==========================================
# ==========================================
# SERVIDOR DUAL (WEBSOCKET + HTTP)
# ==========================================
async def handle_audio_upload(request):
    """Manejador para recibir audios del Studio de Voces (Dashboard)"""
    try:
        data = await request.post()
        audio_file = data.get('audio')
        zap_text = data.get('zapoteco', '...')
        esp_text = data.get('espanol', '...')
        
        if not audio_file:
            return web.json_response({"status": "error", "message": "Falta el archivo de audio"}, status=400)
            
        doc_id = str(uuid.uuid4())
        extension = "webm" # Default del navegador
        filename = f"{doc_id}.{extension}"
        file_path = os.path.join(SAVE_DIR, filename)
        
        # Guardar el archivo en el disco de Azure
        with open(file_path, 'wb') as f:
            f.write(audio_file.file.read())
            
        # Sincronizar con Firestore para que aparezca en el Dataset (ML)
        if db:
            db.collection("translations").document(doc_id).set({
                "stt_text": zap_text,
                "translation": esp_text,
                "audioUrl": f"AZURE_LOCAL:{filename}", # Marca especial para saber que está en Azure
                "status": "completed",
                "source": "web_studio",
                "timestamp": firestore.SERVER_TIMESTAMP,
                "metadata": {
                    "file_path": file_path,
                    "is_training_data": True
                }
            })
            
        print(f"[STUDIO] Nuevo audio guardado: {filename} ({zap_text})")
        
        # Añadimos cabeceras CORS para permitir la conexión desde la web
        headers = {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type"
        }
        return web.json_response({"status": "success", "id": doc_id}, headers=headers)
    except Exception as e:
        print(f"[ERROR STUDIO] {e}")
        return web.json_response({"status": "error", "message": str(e)}, status=500, headers={"Access-Control-Allow-Origin": "*"})

async def handle_options(request):
    """Manejador para el pre-flight de CORS"""
    return web.Response(headers={
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type"
    })

async def websocket_handler(request):
    ws = web.WebSocketResponse()
    await ws.prepare(request)
    
    print(f"[CONEXION] Yoltic Glasses conectados desde {request.remote_addr}")
    
    # Mensaje de bienvenida
    await ws.send_str(json.dumps({
        "translation": "YOLTIC CLOUD - Conectado",
        "source": "system"
    }))

    try:
        async for msg in ws:
            if msg.type == web.WSMsgType.BINARY:
                start_time = time.time()
                pcm_incoming = msg.data
                
                # Procesamiento de audio (igual que antes)
                try:
                    pcm_original = audioop.tomono(pcm_incoming, 2, 1, 0)
                except:
                    pcm_original = pcm_incoming
                
                pcm_boosted = audioop.mul(pcm_original, 2, 5.0) 
                audio_np = np.frombuffer(pcm_original, dtype=np.int16).astype(np.float32) / 32768.0
                
                doc_id = str(uuid.uuid4())
                wav_path = f"temp_audio/{doc_id}.wav"
                os.makedirs("temp_audio", exist_ok=True)
                
                with wave.open(wav_path, 'wb') as wf:
                    wf.setnchannels(1); wf.setsampwidth(2); wf.setframerate(16000)
                    wf.writeframes(pcm_boosted)
                
                # Inferencia
                stt_text, translation = "...", "Error"
                source = "cloud"
                try:
                    stt_text, translation = await asyncio.to_thread(run_cloud_inference, wav_path)
                except Exception as e:
                    print(f"Error inferencia: {e}")
                
                # TTS
                audio_16k = await asyncio.to_thread(generate_azure_tts, translation)
                
                latency_ms = int((time.time() - start_time) * 1000)
                
                # Sincronizar Firestore
                if db:
                    db.collection("translations").document(doc_id).set({
                        "stt_text": stt_text,
                        "translation": translation,
                        "latency_ms": latency_ms,
                        "source": "glasses",
                        "timestamp": firestore.SERVER_TIMESTAMP
                    })
                
                # Responder a los lentes
                await ws.send_str(json.dumps({
                    "translation": translation,
                    "latency_ms": latency_ms
                }))
                
                if audio_16k:
                    await asyncio.sleep(0.1)
                    await ws.send_bytes(audio_16k)
                    
            elif msg.type == web.WSMsgType.ERROR:
                print(f'ws connection closed with exception {ws.exception()}')
    finally:
        print("[DESCONEXION] Yoltic Glasses desconectados.")
    return ws

async def main():
    app = web.Application()
    app.add_routes([
        web.get('/ws', websocket_handler),
        web.post('/upload_audio', handle_audio_upload),
        web.options('/upload_audio', handle_options)
    ])
    
    port = int(os.environ.get("PORT", 8080))
    runner = web.AppRunner(app)
    await runner.setup()
    site = web.TCPSite(runner, "0.0.0.0", port)
    
    print(f"--- Servidor AI Yoltic Dual activo en puerto {port} ---")
    print(f"Endpoints: WS /ws | POST /upload_audio")
    await site.start()
    
    # Mantener vivo el servidor
    while True:
        await asyncio.sleep(3600)

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("Servidor detenido.")

