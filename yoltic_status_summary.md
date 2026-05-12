# 🚀 YOLTIC AR Ecosystem - Final Status & Architecture (Sprint Final)

A continuación, se documenta la arquitectura final estabilizada y 100% funcional del ecosistema YOLTIC para la entrega. Todas las piezas (Hardware, Backend, Frontend y Móvil) han sido conectadas y sincronizadas.

---

## 1. Arquitectura de Hardware (ESP32-S3 + I2S)
*   **Audio de Entrada:** Micrófono INMP441 capturando en `16kHz Mono`.
*   **Audio de Salida:** MAX98357A recibiendo audio decodificado en Base64. Para evitar distorsión, el software del ESP32 duplica los canales (L/R) simulando un estéreo, reproduciendo el TTS fluidamente.
*   **Transmisión (WebSockets):** Se abandonó BLE y HTTP para la transmisión pesada. El ESP32 sube 160KB de audio PCM crudo en 1 segundo usando una conexión WebSocket persistente hacia `ws://[IP_PYTHON]:8080`.

## 2. Motor Híbrido & Procesamiento de Señal (Python Backend)
*   **Tolerancia a Latencia:** `inference_hybrid.py` maneja las solicitudes asíncronamente.
*   **Anti-Distorsión (La Solución Maestra):** Se generan dos canales de audio virtuales al recibir el payload:
    1.  **Audio Original (1x):** Se guarda en el Dashboard para validación humana (Audio limpio).
    2.  **Audio Amplificado (5x):** Se le inyecta un Boost digital (+14dB) y se envía *solo* a Whisper, forzándolo a reconocer el zapoteco incluso si el usuario habló bajo.

## 3. Sincronización de Ecosistema (La Colección "Translations")
Para que el sistema funcione como un producto integrado y no como piezas sueltas, todo el ecosistema ahora lee y escribe de una única fuente de verdad en Firestore: la colección `translations`.
*   **Python:** Escribe el documento con `stt_text`, `translation`, `latency_ms`, y `source`.
*   **Dashboard (Next.js):** Escucha `translations` para la pestaña "Live Feed" y permite a los lingüistas corregir las transcripciones (`corrected_text`).
*   **Flutter App:** Se actualizó `FirebaseService` para escuchar en tiempo real la misma colección `translations`. Ahora la App Móvil sirve como un "Companion App" o puente visual secundario: en cuanto el usuario habla en los lentes, la traducción aparece en su celular automáticamente.

## 4. Pipeline de MLOps & Dataset Final (Hugging Face)
*   El script `dataset_preparation.py` fue ajustado y automatizado.
*   Al ejecutarlo, escanea Firestore buscando únicamente los registros que tengan `corrected_text`.
*   Descarga/copia los audios WAV originales y compila instantáneamente un `metadata.csv` con columnas `[file_name, transcription, translation, corrected_text]` compatible con los loaders de Hugging Face.

---
**ESTADO FINAL DE ENTREGA:** 🏆 **DESPLEGADO Y ESTABILIZADO.**
El proyecto YOLTIC está listo para la demostración final, superando los requisitos técnicos y estéticos iniciales.

---

## ⚡ 5. Fase de Modernización & Despliegue (Azure Cloud)
El ecosistema ha sido escalado para una presentación de nivel productivo:
*   **Azure AI Speech:** Motor principal de TTS (Voz: `es-MX-JorgeNeural`) con sistema de *fallback* automático.
*   **Azure Static Web Apps:** Dashboard desplegado en la nube para acceso global.
*   **UI/UX Modernization:** Rediseño integral basado en **Glassmorphism & Cyberpunk Aesthetics** (Antigravity Engine).
*   **Real-Time Ops:** Sincronización 1:1 entre lentes ESP32, Servidor de Inferencia y Dashboard mediante Firebase Streams.


