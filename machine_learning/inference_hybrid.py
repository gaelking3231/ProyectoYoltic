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
# MODELOS (SOLO CLOUD PARA ESTABILIDAD)
# ==========================================
CT2_AVAILABLE = False
LOCAL_READY = False
print("--- [INFO] Usando Modo Cloud (Optimizado para Azure Basic) ---")


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
        model="claude-3-5-sonnet-20240620",
        max_tokens=50,
        system="Eres un traductor bilingüe experto en Zapoteco del Istmo y Español. Si el texto de entrada está en Español, tradúcelo al Zapoteco del Istmo. Si el texto está en Zapoteco, tradúcelo al Español. Devuelve SOLO la traducción directa.\n\nDICCIONARIO BÁSICO:\n- Padiuxhi / Padiuxi = Hola / Buenos días\n- Sicarú siadó' = Buenos días\n- Sicarú huadxí = Buenas tardes\n- Ximodo nuu lu' = ¿Cómo estás?\n- Xquixe pe' = Gracias\n- Nda / Ola = Hola",
        messages=[{"role": "user", "content": stt_text}]
    )
    translation = claude_msg.content[0].text.strip()
    print(f"STT: {stt_text} -> TRAD: {translation}")
    return stt_text, translation

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
        server_url = "https://yoltic-inference-ai-gre0cqg8cvcye9en.westeurope-01.azurewebsites.net"
        if db:
            db.collection("translations").document(doc_id).set({
                "stt_text": zap_text,
                "translation": esp_text,
                "audioUrl": f"{server_url}/audio/{filename}",
                "status": "completed",
                "source": "web_studio",
                "confidence": 1.0, # 100% porque es validado por un humano
                "timestamp": firestore.SERVER_TIMESTAMP,
                "metadata": {
                    "file_path": file_path,
                    "is_training_data": True
                }
            })
            
            # 📝 ESCRIBIR UN LOG REAL EN EL SISTEMA
            db.collection("logs").add({
                "time": "NOW", # Se formateará en el frontend
                "type": "success",
                "msg": f"Audio recolectado (Dataset): {zap_text[:15]}...",
                "timestamp": firestore.SERVER_TIMESTAMP
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
async def handle_translate(request):
    try:
        print("--- [HTTP] Nueva solicitud de traducción recibida ---", flush=True)
        start_time = time.time()
        pcm_incoming = await request.read()
        
        if not pcm_incoming:
            return web.json_response({"error": "No audio data"}, status=400)
            
        # Procesamiento de audio
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
        try:
            stt_text, translation = await asyncio.to_thread(run_cloud_inference, wav_path)
        except Exception as e:
            print(f"Error inferencia: {e}")
            
        latency_ms = int((time.time() - start_time) * 1000)
        
        # Sincronizar Firestore
        if db:
            db.collection("translations").document(doc_id).set({
                "stt_text": stt_text,
                "translation": translation,
                "latency_ms": latency_ms,
                "source": "glasses_http",
                "confidence": 0.85,
                "timestamp": firestore.SERVER_TIMESTAMP
            })
            db.collection("logs").add({
                "time": "NOW",
                "type": "info",
                "msg": f"Lentes AR (HTTP) procesaron audio ({latency_ms}ms)",
                "timestamp": firestore.SERVER_TIMESTAMP
            })
            
        return web.json_response({
            "translation": translation,
            "latency_ms": latency_ms
        })
    except Exception as e:
        print(f"Error HTTP Translate: {e}")
        return web.json_response({"error": str(e)}, status=500)

async def websocket_handler(request):
    ws = web.WebSocketResponse()
    await ws.prepare(request)
    
    print(f"[CONEXION] Yoltic Glasses conectados desde {request.remote_addr}")
    
    # Mensaje de bienvenida
    await ws.send_str(json.dumps({
        "translation": "YOLTIC CLOUD - Conectado",
        "source": "system"
    }))

    # Buffer for chunked audio
    audio_buffer = bytearray()
    start_time = None

    try:
        async for msg in ws:
            if msg.type == web.WSMsgType.BINARY:
                if not audio_buffer:
                    start_time = time.time()
                audio_buffer.extend(msg.data)
                
            elif msg.type == web.WSMsgType.TEXT:
                if msg.data == "END_AUDIO" and len(audio_buffer) > 0:
                    pcm_incoming = bytes(audio_buffer)
                    audio_buffer = bytearray() # Reset buffer
                    
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
                            "confidence": 0.85, # Confianza estimada del modelo base
                            "timestamp": firestore.SERVER_TIMESTAMP
                        })
                        
                        # 📝 ESCRIBIR UN LOG REAL DE CONEXIÓN AR
                        db.collection("logs").add({
                            "time": "NOW",
                            "type": "info",
                            "msg": f"Lentes AR procesaron audio ({latency_ms}ms)",
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

import zipfile
import io

async def serve_audio(request):
    filename = request.match_info.get('filename')
    filepath = os.path.join(SAVE_DIR, filename)
    if os.path.exists(filepath):
        return web.FileResponse(filepath)
    return web.json_response({"error": "Archivo no encontrado"}, status=404)

async def download_dataset(request):
    zip_buffer = io.BytesIO()
    
    # 1. Recuperar los datos de Firebase para generar el CSV
    csv_content = "filename,zapoteco,espanol\n"
    if db:
        try:
            # Traer todo el dataset de Firestore
            docs = await asyncio.to_thread(lambda: list(db.collection("translations").stream()))
            for doc in docs:
                data = doc.to_dict()
                audio_url = data.get("audioUrl", "")
                if audio_url:
                    filename = audio_url.split("/")[-1]
                    zap = data.get("stt_text", "").replace('"', '""')
                    esp = data.get("translation", "").replace('"', '""')
                    csv_content += f'"{filename}","{zap}","{esp}"\n'
        except Exception as e:
            print(f"Error generando CSV: {e}")

    with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
        # 2. Agregar el archivo de texto maestro al ZIP
        zip_file.writestr("dataset.csv", csv_content)
        
        # 3. Empaquetar todos los audios
        for root, dirs, files in os.walk(SAVE_DIR):
            for file in files:
                if file.endswith('.wav') or file.endswith('.webm'):
                    zip_file.write(os.path.join(root, file), file)
    
    zip_buffer.seek(0)
    return web.Response(
        body=zip_buffer.read(),
        content_type='application/zip',
        headers={'Content-Disposition': 'attachment; filename=yoltic_dataset.zip'}
    )

@web.middleware
async def cors_middleware(request, handler):
    if request.method == "OPTIONS":
        return web.Response(status=204, headers={
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
        })
    try:
        response = await handler(request)
        response.headers["Access-Control-Allow-Origin"] = "*"
        return response
    except Exception as e:
        return web.json_response({"error": str(e)}, status=500, headers={"Access-Control-Allow-Origin": "*"})

async def main():
    try:
        app = web.Application(middlewares=[cors_middleware])
        app.add_routes([
            web.get('/ws', websocket_handler),
            web.post('/upload_audio', handle_audio_upload),
            web.post('/api/translate', handle_translate),
            web.get('/audio/{filename}', serve_audio),
            web.get('/descargar_dataset', download_dataset),
            web.get('/', lambda r: web.Response(text="Servidor Yoltic Activo"))
        ])
        
        port = int(os.environ.get("PORT", 8080))
        runner = web.AppRunner(app)
        await runner.setup()
        site = web.TCPSite(runner, "0.0.0.0", port)
        
        print(f"--- [OK] Servidor Yoltic listo en puerto {port} ---", flush=True)
        await site.start()
        
        # Bucle de latido (Heartbeat) para estabilidad
        counter = 0
        while True:
            await asyncio.sleep(60) # Cada minuto
            counter += 1
            if counter % 10 == 0: # Cada 10 mins
                print(f"--- [Latido] Servidor activo ({counter} min) ---", flush=True)
                
    except Exception as e:
        print(f"--- [CRITICAL ERROR] El loop principal falló: {e} ---", flush=True)
        raise e

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("Servidor detenido.")

