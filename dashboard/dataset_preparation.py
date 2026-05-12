import os
import pandas as pd
import firebase_admin
from firebase_admin import credentials, firestore
import requests

# 1. Autenticación Firebase
try:
    script_dir = os.path.dirname(os.path.abspath(__file__))
    cred_path = os.path.join(script_dir, "serviceAccountKey.json")
    cred = credentials.Certificate(cred_path)
    firebase_admin.initialize_app(cred)
    db = firestore.client()
    print("🔥 Conectado a Firestore para exportar Dataset")
except Exception as e:
    print("❌ Error conectando a Firebase:", e)
    exit(1)

# Carpetas de salida
DATASET_DIR = "hf_dataset"
AUDIO_DIR = os.path.join(DATASET_DIR, "audio")
os.makedirs(AUDIO_DIR, exist_ok=True)

print("🔍 Buscando traducciones corregidas (Semana 1)...")

# 2. Consultar solo audios VALIDADOS (corrected_text != None)
# En Firebase, un campo puede no existir si no lo actualizaron, pero por diseño lo iniciamos en null.
from google.cloud.firestore_v1.base_query import FieldFilter
docs = db.collection("translations").where(filter=FieldFilter("corrected_text", "!=", None)).stream()

metadata = []

for doc in docs:
    data = doc.to_dict()
    
    # Filtro adicional por seguridad (ignorar si es string vacío)
    if not data.get("corrected_text") or data.get("corrected_text") == "":
        continue
        
    doc_id = doc.id
    audio_url = data.get("audioUrl")
    transcription = data.get("originalText", "")
    translation = data.get("translation", "")
    corrected_text = data.get("corrected_text", "")
    corrected_spanish = data.get("corrected_spanish", "")
    
    file_ext = ".wav"
    if audio_url and audio_url.startswith("data:audio/webm"):
        file_ext = ".webm"
        
    local_audio_path = os.path.join(AUDIO_DIR, f"{doc_id}{file_ext}")
    source_audio_path = os.path.join(script_dir, "temp_audio", f"{doc_id}.wav")
    
    if os.path.exists(source_audio_path):
        import shutil
        if not os.path.exists(local_audio_path):
            shutil.copy2(source_audio_path, local_audio_path)
            print(f"✅ Audio {doc_id}.wav copiado localmente.")
    else:
        # Intentar descargar desde Firebase Storage o Base64
        if audio_url:
            if audio_url.startswith("http"):
                try:
                    response = requests.get(audio_url, stream=True)
                    if response.status_code == 200:
                        with open(local_audio_path, 'wb') as f:
                            for chunk in response.iter_content(chunk_size=1024):
                                if chunk:
                                    f.write(chunk)
                        print(f"☁️ Audio {doc_id}.wav descargado desde Firebase Storage.")
                    else:
                        print(f"⚠️ Error descargando {doc_id} de Firebase. Status: {response.status_code}")
                except Exception as e:
                    print(f"⚠️ Error descargando {doc_id} de Firebase: {e}")
            elif audio_url.startswith("data:audio"):
                import base64
                try:
                    header, encoded = audio_url.split(",", 1)
                    audio_data = base64.b64decode(encoded)
                    with open(local_audio_path, 'wb') as f:
                        f.write(audio_data)
                    print(f"😎 Audio {doc_id}{file_ext} extraído de Base64 (Modo Hacker).")
                except Exception as e:
                    print(f"⚠️ Error decodificando Base64 para {doc_id}: {e}")
        else:
            print(f"⚠️ Aviso: No se encontró el audio local ni en la nube para {doc_id}. Se agregará al CSV de todos modos.")
            
    # 4. Formato Hugging Face Dataset
    metadata.append({
        "file_name": f"audio/{doc_id}{file_ext}",
        "transcription": transcription,
        "translation": translation,
        "corrected_text": corrected_text,
        "corrected_spanish": corrected_spanish
    })

# 5. Guardar metadata.csv
csv_path = os.path.join(DATASET_DIR, "metadata.csv")
if metadata:
    df = pd.DataFrame(metadata)
    df.to_csv(csv_path, index=False, encoding='utf-8')
    print(f"\n✅ Dataset exportado exitosamente: {len(metadata)} registros.")
    print(f"📂 Ubicación: {csv_path}")
else:
    print("\n⚠️ No se encontraron registros con traducciones corregidas por Gael.")
    print("👉 Entra al Dashboard y corrige algunas traducciones para poder generar el Dataset.")
