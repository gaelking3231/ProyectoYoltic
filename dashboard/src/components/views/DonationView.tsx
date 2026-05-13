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
      const response = await fetch('https://yoltic-inference-ai-gre0cqg8cvcyc9cn.westeurope-01.azurewebsites.net/upload_audio', {
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
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-black text-white tracking-tighter uppercase">Studio de Voces</h2>
          <p className="text-xs text-[var(--text-dim)] font-bold tracking-widest uppercase mt-1">Preservación Lingüística en Tiempo Real</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--neon-green)]/10 border border-[var(--neon-green)]/20">
          <div className="w-1.5 h-1.5 rounded-full bg-[var(--neon-green)] animate-pulse" />
          <span className="text-[10px] font-bold text-[var(--neon-green)] uppercase tracking-tighter">Micrófono Listo</span>
        </div>
      </div>

      <div className="glass-card p-10 relative overflow-hidden group">
        <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-[var(--neon-green)]/30 to-transparent" />
        
        <div className="text-center space-y-4 mb-10">
          <span className="text-[10px] font-bold text-[var(--text-dim)] uppercase tracking-[0.2em]">Lee la frase en voz alta</span>
          <motion.h1 
            key={currentPhrase.zap}
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="text-5xl font-black text-white tracking-tighter"
          >
            {currentPhrase.zap}
          </motion.h1>
          <p className="text-xl text-[var(--neon-cyan)] font-medium opacity-80 italic">"{currentPhrase.esp}"</p>
        </div>

        <div className="flex flex-col items-center gap-8">
          <AnimatePresence mode="wait">
            {!audioBlob ? (
              <motion.button
                key="record"
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={isRecording ? stopRecording : startRecording}
                className={`w-24 h-24 rounded-full flex items-center justify-center transition-all duration-500 ${
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
