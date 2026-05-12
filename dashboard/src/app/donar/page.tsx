"use client";

import { useState, useRef } from "react";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { storage, db } from "@/lib/firebase";

const SALUDOS = [
  { zap: "Padiuxhi", esp: "Hola / Buenos días" },
  { zap: "Sicarú siadó'", esp: "Buenos días" },
  { zap: "Sicarú huadxí", esp: "Buenas tardes" },
  { zap: "Sicarú gueela'", esp: "Buenas noches" },
  { zap: "Ximodo nuu lu'", esp: "¿Cómo estás?" },
  { zap: "Galán, xquixe pe'", esp: "Bien, gracias" },
  { zap: "Xquixe pe'", esp: "Gracias" },
  { zap: "Sicarú guibá'", esp: "Que te vaya bien" },
  { zap: "Ma ziaa'", esp: "Ya me voy" },
  { zap: "Pa Dios", esp: "Adiós" }
];

export default function DonarAudio() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [success, setSuccess] = useState(false);

  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const audioChunks = useRef<Blob[]>([]);

  const currentPhrase = SALUDOS[currentIndex];

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Dejamos que el dispositivo decida su formato nativo (Safari usa audio/mp4 por defecto)
      mediaRecorder.current = new MediaRecorder(stream);
      audioChunks.current = [];

      mediaRecorder.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunks.current.push(event.data);
        }
      };

      mediaRecorder.current.onstop = () => {
        const type = mediaRecorder.current?.mimeType || "audio/mp4";
        const blob = new Blob(audioChunks.current, { type });
        if (blob.size > 0) {
          setAudioBlob(blob);
          setAudioUrl(URL.createObjectURL(blob));
        } else {
          alert("El audio no se detectó. Por favor, habla más fuerte.");
        }
      };

      mediaRecorder.current.start();
      setIsRecording(true);
      setSuccess(false);
    } catch (err) {
      console.error("Error accessing microphone:", err);
      alert("Error al acceder al micrófono. Por favor verifica los permisos.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorder.current && isRecording) {
      mediaRecorder.current.stop();
      setIsRecording(false);
      // Detener el stream del micrófono
      mediaRecorder.current.stream.getTracks().forEach((track) => track.stop());
    }
  };

  const deleteRecording = () => {
    setAudioBlob(null);
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
    }
  };

  const uploadRecording = async () => {
    if (!audioBlob || audioBlob.size < 100) {
      alert("El audio parece estar vacío. Por favor, intenta grabar de nuevo.");
      return;
    }
    
    setIsUploading(true);
    try {
      const id = crypto.randomUUID();
      
      // Volvemos al método de Base64 porque Firebase Storage requiere configuración extra
      const reader = new FileReader();
      reader.readAsDataURL(audioBlob);
      
      reader.onloadend = async () => {
        const base64Audio = reader.result as string;
        
        const docRef = doc(db, "translations", id);
        await setDoc(docRef, {
          originalText: currentPhrase.zap, 
          translation: currentPhrase.esp,
          corrected_text: currentPhrase.zap,
          corrected_spanish: currentPhrase.esp,
          audioUrl: base64Audio,
          status: "completed",
          confidence: 100,
          source: "web_studio",
          timestamp: serverTimestamp(),
          metadata: {
            processingTimeMs: 0
          }
        });

        setSuccess(true);
        deleteRecording();
        setCurrentIndex((prev) => (prev + 1) % SALUDOS.length);
        setIsUploading(false);
      };
      
    } catch (error) {
      console.error("Error subiendo el audio:", error);
      alert("Hubo un error subiendo tu audio. Intenta de nuevo.");
      setIsUploading(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>YOLTIC - Estudio de Voces</h1>
        <p style={styles.subtitle}>Ayúdanos a preservar el Zapoteco donando tu voz</p>
      </div>

      <div style={styles.card}>
        <div style={styles.instruction}>Por favor, lee esta frase en voz alta:</div>
        
        <div style={styles.phraseBox}>
          <div style={styles.zapotecPhrase}>{currentPhrase.zap}</div>
          <div style={styles.spanishMeaning}>({currentPhrase.esp})</div>
        </div>

        {success && (
          <div style={styles.successMessage}>
            ✅ ¡Audio guardado exitosamente! Muchas gracias.
          </div>
        )}

        {!audioBlob ? (
          <div style={styles.recordingSection}>
            <button
              style={{
                ...styles.recordButton,
                backgroundColor: isRecording ? "#ef4444" : "#10b981",
                animation: isRecording ? "pulse 1.5s infinite" : "none"
              }}
              onClick={isRecording ? stopRecording : startRecording}
            >
              {isRecording ? "🔴 Detener grabación" : "🎙️ Toca para grabar"}
            </button>
            <div style={styles.helperText}>
              {isRecording 
                ? "Grabando... Toca el botón cuando termines de hablar." 
                : "Toca el botón, lee la frase en voz alta y vuelve a tocar para terminar."}
            </div>
          </div>
        ) : (
          <div style={styles.playbackSection}>
            <p style={{ fontSize: "14px", fontWeight: "bold", marginBottom: "8px" }}>Escucha tu grabación:</p>
            <audio src={audioUrl || ""} controls playsInline preload="auto" style={styles.audioPlayer} />
            
            <div style={styles.buttonRow}>
              <button onClick={deleteRecording} style={styles.deleteButton} disabled={isUploading}>
                🗑️ Volver a grabar
              </button>
              <button onClick={uploadRecording} style={styles.uploadButton} disabled={isUploading}>
                {isUploading ? "Subiendo..." : "🚀 Enviar Audio"}
              </button>
            </div>
          </div>
        )}

        {!isRecording && !audioBlob && (
           <button 
             onClick={() => setCurrentIndex((prev) => (prev + 1) % SALUDOS.length)} 
             style={styles.skipButton}
           >
             Saltar a otra frase ⏭️
           </button>
        )}
      </div>

      <style>{`
        @keyframes pulse {
          0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); }
          70% { transform: scale(1.05); box-shadow: 0 0 0 15px rgba(239, 68, 68, 0); }
          100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
        }
      `}</style>
    </div>
  );
}

const styles = {
  container: {
    minHeight: "100vh",
    backgroundColor: "#050505",
    backgroundImage: "radial-gradient(circle at 50% -20%, rgba(16, 185, 129, 0.15), transparent 60%)",
    color: "#f8fafc",
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    padding: "40px 20px",
    fontFamily: "system-ui, -apple-system, sans-serif"
  },
  header: {
    textAlign: "center" as const,
    marginBottom: "40px"
  },
  title: {
    fontSize: "28px",
    fontWeight: "bold",
    margin: "0 0 8px 0",
    color: "#10b981"
  },
  subtitle: {
    fontSize: "16px",
    color: "#94a3b8",
    margin: 0
  },
  card: {
    backgroundColor: "rgba(20, 20, 25, 0.6)",
    backdropFilter: "blur(12px)",
    WebkitBackdropFilter: "blur(12px)",
    border: "1px solid rgba(255, 255, 255, 0.08)",
    borderRadius: "16px",
    padding: "32px",
    width: "100%",
    maxWidth: "500px",
    boxShadow: "0 20px 40px rgba(0,0,0,0.4), 0 0 20px rgba(16, 185, 129, 0.1)",
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center"
  },
  instruction: {
    fontSize: "14px",
    color: "#cbd5e1",
    marginBottom: "16px",
    textTransform: "uppercase" as const,
    letterSpacing: "0.05em"
  },
  phraseBox: {
    backgroundColor: "rgba(10, 10, 15, 0.8)",
    border: "1px solid rgba(16, 185, 129, 0.3)",
    boxShadow: "inset 0 0 15px rgba(16, 185, 129, 0.05)",
    borderRadius: "12px",
    padding: "32px 24px",
    width: "100%",
    textAlign: "center" as const,
    marginBottom: "32px"
  },
  zapotecPhrase: {
    fontSize: "32px",
    fontWeight: "bold",
    color: "#38bdf8",
    marginBottom: "8px"
  },
  spanishMeaning: {
    fontSize: "18px",
    color: "#94a3b8"
  },
  recordingSection: {
    width: "100%",
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center"
  },
  recordButton: {
    width: "100%",
    padding: "20px",
    borderRadius: "100px",
    border: "none",
    color: "white",
    fontSize: "16px",
    fontWeight: "bold",
    cursor: "pointer",
    transition: "all 0.2s ease",
    marginBottom: "12px",
    userSelect: "none" as const,
    WebkitUserSelect: "none" as const
  },
  helperText: {
    fontSize: "13px",
    color: "#64748b",
    textAlign: "center" as const
  },
  playbackSection: {
    width: "100%",
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center"
  },
  audioPlayer: {
    width: "100%",
    marginBottom: "20px"
  },
  buttonRow: {
    display: "flex",
    gap: "12px",
    width: "100%"
  },
  deleteButton: {
    flex: 1,
    padding: "14px",
    backgroundColor: "transparent",
    border: "1px solid #ef4444",
    color: "#ef4444",
    borderRadius: "8px",
    fontWeight: "bold",
    cursor: "pointer",
  },
  uploadButton: {
    flex: 1,
    padding: "14px",
    backgroundColor: "#10b981",
    border: "none",
    color: "white",
    borderRadius: "8px",
    fontWeight: "bold",
    cursor: "pointer",
  },
  skipButton: {
    marginTop: "24px",
    backgroundColor: "transparent",
    border: "none",
    color: "#64748b",
    fontSize: "14px",
    cursor: "pointer",
    textDecoration: "underline"
  },
  successMessage: {
    width: "100%",
    padding: "12px",
    backgroundColor: "rgba(16, 185, 129, 0.1)",
    color: "#34d399",
    borderRadius: "8px",
    textAlign: "center" as const,
    marginBottom: "20px",
    fontWeight: 500
  }
};
