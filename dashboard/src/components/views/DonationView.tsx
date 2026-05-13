"use client";

import { useState, useRef } from "react";
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
      const formData = new FormData();
      formData.append("audio", audioBlob);
      formData.append("zapoteco", currentPhrase.zap);
      formData.append("espanol", currentPhrase.esp);

      const response = await fetch('https://yoltic-inference-ai-gre0cqg8cvcye9en.westeurope-01.azurewebsites.net/upload_audio', {
        method: "POST",
        body: formData,
      });

      if (!response.ok) throw new Error("Fallo al subir a Azure");
      
      setSuccess(true);
      setAudioBlob(null);
      setAudioUrl(null);
      setCurrentIndex((prev) => (prev + 1) % SALUDOS.length);
    } catch (error) {
      console.error("Error subiendo audio:", error);
      alert("Error crítico: El servidor no respondió.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="flex flex-col h-full space-y-4 p-2 sm:p-4 md:p-6 overflow-y-auto custom-scrollbar">
      {/* Header Responsivo */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-2 sm:space-y-0">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tighter text-white uppercase">Studio de Voces</h1>
          <p className="text-[10px] sm:text-xs text-cyan-400/60 font-mono tracking-widest uppercase">
            Preservación Lingüística en Tiempo Real
          </p>
        </div>
        <div className="flex items-center space-x-2 bg-black/40 border border-cyan-500/30 px-3 py-1.5 rounded-full shadow-[0_0_15px_rgba(6,182,212,0.1)]">
          <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_8px_rgba(6,182,212,1)]" />
          <span className="text-[10px] font-mono text-cyan-400 uppercase tracking-tighter">Micrófono Listo</span>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center py-4">
        <div className="w-full max-w-2xl bg-gradient-to-br from-gray-900/90 to-black/90 border border-white/5 rounded-3xl p-6 sm:p-10 shadow-2xl relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-cyan-500/30 to-transparent" />
          
          <div className="space-y-8 sm:space-y-12">
            <div className="text-center space-y-4 sm:space-y-6">
              <span className="text-[10px] font-mono text-cyan-400/50 uppercase tracking-[0.3em]">Lee la frase en voz alta</span>
              <h2 className="text-4xl sm:text-6xl font-black text-white tracking-tighter leading-none">
                {currentPhrase.zap}
              </h2>
              <p className="text-xl sm:text-2xl text-cyan-400/80 italic font-medium">
                "{currentPhrase.esp}"
              </p>
            </div>

            <div className="flex flex-col items-center space-y-6 sm:space-y-8 pt-4">
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
                    className={`w-24 h-24 sm:w-32 sm:h-32 rounded-full flex items-center justify-center transition-all duration-500 ${
                      isRecording 
                        ? 'bg-rose-500 shadow-[0_0_30px_rgba(244,63,94,0.4)] animate-pulse' 
                        : 'bg-cyan-500 shadow-[0_0_30px_rgba(6,182,212,0.3)]'
                    }`}
                  >
                    {isRecording ? <Square fill="white" size={32} className="text-white" /> : <Mic fill="black" size={32} className="text-slate-950" />}
                  </motion.button>
                ) : (
                  <motion.div 
                    key="preview"
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    className="w-full space-y-6 sm:space-y-8"
                  >
                    <div className="p-4 rounded-2xl bg-white/5 border border-white/10 shadow-inner">
                      <audio src={audioUrl || ""} controls className="w-full h-10" />
                    </div>
                    
                    <div className="flex flex-col sm:flex-row gap-4">
                      <button 
                        onClick={() => { setAudioBlob(null); setAudioUrl(null); }}
                        className="flex-1 flex items-center justify-center gap-2 py-4 rounded-xl border border-white/10 text-white/60 hover:bg-white/5 transition-all font-bold text-xs uppercase tracking-widest"
                      >
                        <Trash2 size={14} /> Descartar
                      </button>
                      <button 
                        onClick={uploadRecording}
                        disabled={isUploading}
                        className="flex-1 flex items-center justify-center gap-2 py-4 rounded-xl bg-cyan-500 text-slate-950 hover:shadow-[0_0_20px_rgba(6,182,212,0.5)] transition-all font-black text-xs uppercase tracking-widest disabled:opacity-50"
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
                  className="flex items-center gap-2 text-cyan-400 font-bold text-xs uppercase tracking-tighter"
                >
                  <CheckCircle2 size={14} /> ¡Audio guardado en el Dataset!
                </motion.div>
              )}

              <button 
                onClick={() => { setCurrentIndex((prev) => (prev + 1) % SALUDOS.length); setSuccess(false); }}
                className="text-[10px] text-white/40 hover:text-white transition-colors flex items-center gap-2 uppercase tracking-widest font-black"
              >
                Siguiente Frase <ChevronRight size={12} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
