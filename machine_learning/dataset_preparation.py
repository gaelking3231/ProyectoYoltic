import os
import csv
import requests
import firebase_admin
from firebase_admin import credentials, firestore

# Inicializar Firebase
try:
    cred = credentials.Certificate('serviceAccountKey.json')
    firebase_admin.initialize_app(cred)
    db = firestore.client()
    print("✅ Conectado a Firestore para extracción de dataset.")
except Exception as e:
    print(f"❌ Error al conectar con Firebase: {e}")
    exit(1)

DATASET_DIR = "dataset_s1_saludos"
AUDIO_DIR = os.path.join(DATASET_DIR, "wavs")

# Crear directorios
os.makedirs(AUDIO_DIR, exist_ok=True)

csv_path = os.path.join(DATASET_DIR, "metadata.csv")

def extract_dataset():
    print("🔍 Escaneando Firestore por traducciones validadas...")
    
    # Obtener documentos de la colección 'translations'
    docs = db.collection("translations").get()
    
    valid_records = []
    
    for doc in docs:
        data = doc.to_dict()
        corrected_text = data.get("corrected_text")
        audio_url = data.get("audioUrl")
        
        # Solo tomamos los que han sido corregidos (validados en el dashboard)
        if corrected_text and audio_url:
            valid_records.append({
                "id": doc.id,
                "transcription": data.get("stt_text", ""),
                "translation": data.get("translation", ""),
                "corrected_text": corrected_text,
                "audio_url": audio_url
            })
            
    if not valid_records:
        print("⚠️ No se encontraron registros validados con audio en Firestore.")
        return

    print(f"📦 Se encontraron {len(valid_records)} registros validados. Descargando audios y generando CSV...")

    with open(csv_path, mode="w", newline="", encoding="utf-8") as csv_file:
        fieldnames = ["file_name", "transcription", "translation", "corrected_text"]
        writer = csv.DictWriter(csv_file, fieldnames=fieldnames)
        writer.writeheader()
        
        for i, record in enumerate(valid_records):
            doc_id = record["id"]
            audio_url = record["audio_url"]
            file_name = f"{doc_id}.wav"
            local_audio_path = os.path.join(AUDIO_DIR, file_name)
            
            # Descargar o copiar archivo de audio
            try:
                if audio_url.startswith("/dataset_audio/"):
                    # Ruta local en el dashboard
                    public_audio_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "dashboard", "public", "dataset_audio", file_name))
                    import shutil
                    if os.path.exists(public_audio_path):
                        shutil.copy2(public_audio_path, local_audio_path)
                    else:
                        print(f"⚠️ No se encontró el archivo local: {public_audio_path}")
                        continue
                else:
                    # Ruta web (Firebase Storage u otro)
                    response = requests.get(audio_url, stream=True)
                    if response.status_code == 200:
                        with open(local_audio_path, 'wb') as f:
                            for chunk in response.iter_content(chunk_size=1024):
                                if chunk:
                                    f.write(chunk)
                    else:
                        print(f"⚠️ Error al descargar {audio_url}")
                        continue
            except Exception as e:
                print(f"⚠️ Error al obtener el audio {doc_id}: {e}")
                continue
                
            # Escribir fila en el CSV (Formato Hugging Face)
            writer.writerow({
                "file_name": f"wavs/{file_name}",
                "transcription": record["transcription"],
                "translation": record["translation"],
                "corrected_text": record["corrected_text"]
            })
            
            print(f"✅ ({i+1}/{len(valid_records)}) Procesado: {doc_id}")

    print(f"\n🎉 ¡Extracción completada! Dataset listo en: {os.path.abspath(DATASET_DIR)}")
    print("Siguiente paso: Subir la carpeta a Hugging Face para Fine-Tuning.")

if __name__ == "__main__":
    extract_dataset()
