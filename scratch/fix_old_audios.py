import firebase_admin
from firebase_admin import credentials, firestore
import os

# Configuración
SERVER_URL = "https://yoltic-inference-ai-gre0cqg8cvcye9en.westeurope-01.azurewebsites.net"
KEY_PATH = "dashboard/serviceAccountKey.json"

if not os.path.exists(KEY_PATH):
    print(f"Error: No se encontró el archivo de llaves en {KEY_PATH}")
    exit(1)

# Inicializar Firebase
cred = credentials.Certificate(KEY_PATH)
firebase_admin.initialize_app(cred)
db = firestore.client()

def fix_audios():
    print("--- [FIX] Buscando audios antiguos con URL incorrecta ---")
    
    # Buscar en la colección 'translations'
    docs = db.collection("translations").where("source", "==", "web_studio").stream()
    
    count = 0
    for doc in docs:
        data = doc.to_dict()
        audio_url = data.get("audioUrl", "")
        
        # Si NO tiene el westeurope-01, lo corregimos
        if ".azurewebsites.net" in audio_url and "westeurope-01" not in audio_url:
            filename = audio_url.split("/")[-1]
            new_url = f"{SERVER_URL}/audio/{filename}"
            
            db.collection("translations").document(doc.id).update({
                "audioUrl": new_url
            })
            print(f"[FIX] Corregido: {filename}")
            count += 1
            
    print(f"\n--- [LISTO] Se corrigieron {count} registros ---")

if __name__ == "__main__":
    fix_audios()
