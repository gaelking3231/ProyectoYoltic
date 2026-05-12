import os
import time
import json
import asyncio
import base64
import wave
import audioop
import numpy as np
import soundfile as sf
import websockets
from dotenv import load_dotenv

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
        cred_path = os.path.join(os.path.dirname(__file__), "..", "dashboard", "serviceAccountKey.json")
        cred = credentials.Certificate(cred_path)
        firebase_admin.initialize_app(cred, {
            'storageBucket': 'proyectoyoltic.firebasestorage.app'
        })
    db = firestore.client()
    print("Sincronización con Firebase y Storage Activa")
except Exception as e:
    print(f"Aviso: Firebase desactivado. No se encontró 'serviceAccountKey.json'. Razón: {e}")

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
async def process_audio_stream(websocket):
    print(f"[CONEXION] Yoltic Glasses conectados desde {websocket.remote_address}")
    
    # 0. MENSAJE DE BIENVENIDA (OLED)
    try:
        welcome_payload = {
            "translation": "YOLTIC V1.0 - Listo",
            "audio": "",
            "latency_ms": 0,
            "source": "system"
        }
        await websocket.send(json.dumps(welcome_payload))
        print("[OLED] Mensaje de bienvenida enviado: 'YOLTIC V1.0 - Listo'")
    except Exception as e:
        print(f"[ERROR] Error enviando bienvenida: {e}")

    try:
        async for message in websocket:
            if isinstance(message, bytes):
                start_time = time.time()
                
                # 1. RECIBIR AUDIO
                pcm_incoming = message
                
                # 1. RECIBIR AUDIO DEL ESP32
                pcm_incoming = message
                
                # ESP32 manda Estéreo (I2S_CHANNEL_FMT_RIGHT_LEFT) pero el INMP441 graba solo en Izquierdo
                # Usamos audioop para pasarlo a Mono, tomando el canal izquierdo
                try:
                    pcm_original = audioop.tomono(pcm_incoming, 2, 1, 0)
                except Exception as e:
                    print(f"Error tomono: {e}")
                    pcm_original = pcm_incoming
                
                print(f"[AUDIO] Recibido ({len(pcm_original)} bytes) - Procesando...")
                
                # 2. PREPARAR SEÑAL
                # Boosted (5x) solo para Whisper, Original para Dashboard
                pcm_boosted = audioop.mul(pcm_original, 2, 5.0) 
                audio_np = np.frombuffer(pcm_original, dtype=np.int16).astype(np.float32) / 32768.0
                
                # 3. GUARDAR TEMPORALES
                doc_id = str(uuid.uuid4())
                os.makedirs("temp_audio", exist_ok=True)
                wav_path = f"temp_audio/{doc_id}.wav"
                
                try:
                    with wave.open(wav_path, 'wb') as wf:
                        wf.setnchannels(1); wf.setsampwidth(2); wf.setframerate(16000)
                        wf.writeframes(pcm_boosted)
                except Exception as e:
                    print(f"[ERROR] Fallo al guardar WAV: {e}")
                
                # 4. INFERENCIA HÍBRIDA
                stt_text = "..."
                translation = "Error de conexión"
                source = "local"
                
                try:
                    if not LOCAL_READY:
                        raise ValueError("Modelos locales no disponibles")
                        
                    # Intento Local (Esperamos hasta 15 segundos porque las CPUs pueden ser lentas)
                    stt_text, translation = await asyncio.wait_for(
                        asyncio.to_thread(run_local_inference, audio_np),
                        timeout=15.0
                    )
                except Exception as e:
                    # Fallback Cloud (Robusto)
                    print(f"[CLOUD] Cambiando a modo Nube... ({e})")
                    source = "cloud"
                    try:
                        stt_text, translation = await asyncio.to_thread(run_cloud_inference, wav_path)
                    except Exception as cloud_err:
                        print(f"[CRITICAL] Fallo total de inferencia: {cloud_err}")
                        translation = "No pude entenderte"
                
                # 5. SÍNTESIS DE VOZ (Azure-First TTS)
                print(f"[TRADUCCION] '{stt_text}' -> '{translation}'")
                pcm_out_base64 = ""
                audio_16k = None
                
                try:
                    # Intentamos Azure primero (Mejor calidad)
                    print("[VOZ] Generando audio con Azure Neural TTS...")
                    audio_16k = await asyncio.to_thread(generate_azure_tts, translation)
                    
                    if not audio_16k:
                        # Fallback a OpenAI si Azure falla
                        print("[VOZ] Azure falló, usando OpenAI TTS...")
                        tts_response = await asyncio.to_thread(
                            lambda: openai_client.audio.speech.create(
                                model="tts-1", voice="alloy", input=translation, response_format="pcm"
                            )
                        )
                        audio_raw = tts_response.content
                        audio_16k, _ = audioop.ratecv(audio_raw, 2, 1, 24000, 16000, None)
                except Exception as e:
                    print(f"[ERROR] Error generando audio: {e}")


                latency_ms = int((time.time() - start_time) * 1000)
                
                # 6. SINCRONIZACIÓN FIRESTORE (Dashboard)
                if db:
                    try:
                        # Copiar audio al dashboard/public
                        public_audio_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "dashboard", "public", "dataset_audio"))
                        os.makedirs(public_audio_dir, exist_ok=True)
                        dashboard_wav_path = os.path.join(public_audio_dir, f"{doc_id}.wav")
                        import shutil
                        shutil.copy2(wav_path, dashboard_wav_path)
                        
                        audio_url = f"/dataset_audio/{doc_id}.wav"
                        
                        # Guardar en Firestore con Esquema Unificado
                        db.collection("translations").document(doc_id).set({
                            "stt_text": stt_text,
                            "translation": translation,
                            "audioUrl": audio_url,
                            "corrected_text": None,
                            "latency_ms": latency_ms,
                            "source": source,
                            "timestamp": firestore.SERVER_TIMESTAMP
                        })
                        print(f"[DASHBOARD] Datos sincronizados en Firestore (ID: {doc_id[:8]})")
                    except Exception as e:
                        print(f"[FIREBASE] Error de sincronización: {e}")
                
                # 7. RESPUESTA FINAL
                print(f"[ENVIO] Respuesta enviada a los lentes. Latencia: {latency_ms}ms\n")
                
                # Primero enviamos el texto en un pequeño JSON
                response_payload = {
                    "translation": translation,
                    "latency_ms": latency_ms,
                    "source": source
                }
                await websocket.send(json.dumps(response_payload))
                
                # Le damos un instante al ESP32 para leer el texto
                await asyncio.sleep(0.1)
                
                # Enviamos el audio en formato binario puro (más rápido y sin bloqueos de memoria)
                if 'audio_16k' in locals() and len(audio_16k) > 0:
                    await websocket.send(audio_16k)
                else:
                    print("Advertencia: No hay audio para enviar")
                
            else:
                print("[WARNING] Mensaje recibido no es binario.")
                
    except websockets.exceptions.ConnectionClosed:
        print(f"[DESCONEXION] Yoltic Glasses desconectados.")
    except Exception as e:
        print(f"[ERROR FATAL] {e}")

async def main():
    print("--- Servidor Hibrido YOLTIC (TAREA 2) iniciado en ws://0.0.0.0:8080")
    async with websockets.serve(process_audio_stream, "0.0.0.0", 8080):
        await asyncio.Future()

if __name__ == "__main__":
    asyncio.run(main())
