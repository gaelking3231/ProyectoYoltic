"use client";

import { useState, useRef } from "react";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { storage, db } from "@/lib/firebase";
import { Mic, Square, Trash2, Send, ChevronRight, CheckCircle2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

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

export default function DonationView() {
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
      mediaRecorder.current = new MediaRecorder(stream);
      audioChunks.current = [];

      mediaRecorder.current.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunks.current.push(event.data);
      };

      mediaRecorder.current.onstop = () => {
        const type = mediaRecorder.current?.mimeType || "audio/mp4";
        const blob = new Blob(audioChunks.current, { type });
        if (blob.size > 0) {
          setAudioBlob(blob);
          setAudioUrl(URL.createObjectURL(blob));
        }
      };

      mediaRecorder.current.start();
      setIsRecording(true);
      setSuccess(false);
    } catch (err) {
      console.error("Error micro:", err);
      alert("Permiso de micrófono denegado.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorder.current && isRecording) {
      mediaRecorder.current.stop();
      setIsRecording(false);
      mediaRecorder.current.stream.getTracks().forEach((track) => track.stop());
    }
  };

  const uploadRecording = async () => {
    if (!audioBlob) return;
    setIsUploading(true);
    try {
      // Preparamos los datos para mandar al servidor de Azure
      const formData = new FormData();
      formData.append("audio", audioBlob);
      formData.append("zapoteco", currentPhrase.zap);
      formData.append("espanol", currentPhrase.esp);

      // URL de tu servidor de Python en Azure
      const response = await fetch('https://yoltic-inference-ai-gre0cqg8cvcye9en.westeurope-01.azurewebsites.net/upload_audio', {
        method: "POST",
        body: formData,
      });

      if (!response.ok) throw new Error("Fallo al subir a Azure");
      
      const result = await response.json();

      setSuccess(true);
      setAudioBlob(null);
      setAudioUrl(null);
      setCurrentIndex((prev) => (prev + 1) % SALUDOS.length);
    } catch (error) {
      console.error("Error subiendo audio a Azure:", error);
      alert("Error crítico: El servidor de Azure no respondió. Verifica que esté encendido.");
    } finally {
      setIsUploading(false);
    }
  };


  return (
    <div className="flex flex-col h-full space-y-4 p-2 sm:p-4 md:p-6 overflow-y-auto custom-scrollbar">
      {/* Header Responsivo */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-2 sm:space-y-0">
        <div>
                  isRecording 
                    ? 'bg-rose-500 shadow-[0_0_30px_rgba(244,63,94,0.4)] animate-pulse' 
                    : 'bg-[var(--neon-green)] shadow-[0_0_30px_rgba(16,185,129,0.3)]'
                }`}
              >
                {isRecording ? <Square fill="white" size={32} className="text-white" /> : <Mic fill="black" size={32} className="text-slate-950" />}
              </motion.button>
            ) : (
              <motion.div 
                key="preview"
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="w-full space-y-6"
              >
                <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
                  <audio src={audioUrl || ""} controls className="w-full h-10 accent-[var(--neon-green)]" />
                </div>
                
                <div className="flex gap-4">
                  <button 
                    onClick={() => { setAudioBlob(null); setAudioUrl(null); }}
                    className="flex-1 flex items-center justify-center gap-2 py-4 rounded-xl border border-white/10 text-white/60 hover:bg-white/5 transition-all font-bold text-xs uppercase tracking-widest"
                  >
                    <Trash2 size={14} /> Descartar
                  </button>
                  <button 
                    onClick={uploadRecording}
                    disabled={isUploading}
                    className="flex-1 flex items-center justify-center gap-2 py-4 rounded-xl bg-[var(--neon-green)] text-slate-950 hover:shadow-[0_0_20px_var(--neon-glow)] transition-all font-black text-xs uppercase tracking-widest disabled:opacity-50"
                  >
                    {isUploading ? "Procesando..." : <><Send size={14} /> Enviar a la IA</>}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {success && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-2 text-[var(--neon-green)] font-bold text-xs uppercase tracking-tighter"
            >
              <CheckCircle2 size={14} /> ¡Audio guardado en el Dataset!
            </motion.div>
          )}

          <button 
            onClick={() => { setCurrentIndex((prev) => (prev + 1) % SALUDOS.length); setSuccess(false); }}
            className="text-[10px] text-[var(--text-dim)] hover:text-white transition-colors flex items-center gap-2 uppercase tracking-widest font-black"
          >
            Siguiente Frase <ChevronRight size={12} />
          </button>
        </div>
      </div>
    </div>
  );
}
