"use client";

import { useEffect, useRef, useState } from "react";
import WaveSurfer from "wavesurfer.js";

interface WaveformPlayerProps {
  audioUrl: string;
}

export default function WaveformPlayer({ audioUrl }: WaveformPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const wavesurferRef = useRef<WaveSurfer | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isReady, setIsReady] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Quitamos los logs de audioUrl porque son cadenas gigantes que pueden trabar tu terminal
  const isBase64 = audioUrl && (audioUrl.startsWith("data:") || audioUrl.length > 1000);

  if (isBase64) {
    return (
      <div style={{ display: "flex", alignItems: "center", height: "40px", width: "100%", maxWidth: "300px" }}>
        <audio 
          src={audioUrl} 
          controls 
          style={{ width: "100%", height: "32px" }} 
          onError={(e) => {
            // Usamos warn en lugar de error para que Next.js no te bloquee con la pantalla roja
            console.warn("Aviso en reproductor nativo (Base64):", e);
          }}
        />
      </div>
    );
  }

  useEffect(() => {

    // Crear el elemento de audio manualmente para evitar que WaveSurfer le ponga crossOrigin='anonymous'
    // que es lo que causa el NetworkError/MediaError con Base64 y Blob URLs.
    const audio = new Audio();
    audio.src = audioUrl;
    
    // Solo aplicar crossOrigin para URLs externas (HTTP/HTTPS)
    if (audioUrl.startsWith("http")) {
      audio.crossOrigin = "anonymous";
    }

    if (!containerRef.current) return;

    const ws = WaveSurfer.create({
      container: containerRef.current,
      waveColor: "rgba(16, 185, 129, 0.4)",
      progressColor: "#10B981",
      cursorColor: "#ffffff",
      barWidth: 2,
      barGap: 1,
      barRadius: 2,
      height: 40,
      media: audio, // Pasamos el audio controlado
    });

    ws.on("ready", () => {
      setIsReady(true);
      setErrorMsg(null);
      ws.setPlaybackRate(playbackRate);
    });

    ws.on("play", () => setIsPlaying(true));
    ws.on("pause", () => setIsPlaying(false));
    ws.on("finish", () => setIsPlaying(false));
    ws.on("error", (err) => {
      console.warn("WaveSurfer warning:", err);
      // Evitamos bloquear el dashboard entero
      setErrorMsg("No se pudo cargar la onda de audio.");
      setIsReady(false);
    });

    wavesurferRef.current = ws;

    return () => {
      if (ws) {
        try {
          ws.unAll(); // Desvincular eventos antes de destruir
          ws.destroy();
        } catch (e) {
          // Silenciamos errores de destrucción durante el desmontaje
        }
      }
    };
  }, [audioUrl]); // Quitamos playbackRate para no recrear el componente al cambiar la velocidad


  const handlePlayPause = () => {
    if (wavesurferRef.current && isReady) {
      wavesurferRef.current.playPause();
    }
  };

  const handleSpeedChange = (speed: number) => {
    setPlaybackRate(speed);
    if (wavesurferRef.current) {
      wavesurferRef.current.setPlaybackRate(speed);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)", width: "100%", maxWidth: "300px" }}>
      {errorMsg ? (
        <div style={{ color: "#ef4444", fontSize: "12px", padding: "8px" }}>
          Error: {errorMsg}
        </div>
      ) : (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-4)" }}>
            <button 
              className="audio-btn" 
              onClick={handlePlayPause} 
              disabled={!isReady}
              style={{ width: 40, height: 40, flexShrink: 0, fontSize: "var(--font-size-lg)", opacity: isReady ? 1 : 0.5, border: "none", background: "transparent", cursor: isReady ? "pointer" : "not-allowed", color: "var(--color-accent)" }}
              aria-label={isPlaying ? "Pausar Audio" : "Reproducir Audio"}
            >
              {isPlaying ? "⏸" : "▶"}
            </button>
            
            <div ref={containerRef} style={{ flex: 1 }} />
          </div>

          <div style={{ display: "flex", gap: "var(--space-2)", fontSize: "var(--font-size-xs)", justifyContent: "flex-end" }}>
            {[0.5, 1, 1.5].map(speed => (
              <button
                key={speed}
                onClick={() => handleSpeedChange(speed)}
                style={{
                  background: playbackRate === speed ? "var(--color-accent)" : "var(--color-bg-tertiary)",
                  color: playbackRate === speed ? "#fff" : "var(--color-text-secondary)",
                  border: "1px solid var(--color-border)",
                  borderRadius: "4px",
                  padding: "2px 6px",
                  cursor: "pointer",
                  fontFamily: "var(--font-mono)"
                }}
              >
                {speed}x
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
