"use client";

import { useState, useEffect } from "react";
import { useDevices } from "@/lib/hooks";

const MOCK_EVENTS = [
  { time: "18:45:02", msg: "ESP32-S3 connected to Hotspot" },
  { time: "18:45:05", msg: "Antigravity middleware started" },
  { time: "18:45:10", msg: "Audio stream optimized for ZAP_ISTMO" },
];

export default function DevicesView() {
  const [showPairing, setShowPairing] = useState(false);
  const [pairingStep, setPairingStep] = useState(0);
  const { devices, loading } = useDevices();
  const [now, setNow] = useState(new Date());

  // Heartbeat loop
  useEffect(() => {
    const intval = setInterval(() => {
      setNow(new Date());
    }, 10000);
    return () => clearInterval(intval);
  }, []);

  const startPairing = () => {
    setShowPairing(true);
    setPairingStep(1); // Scanning
    setTimeout(() => setPairingStep(2), 2000); // Connected
    setTimeout(() => setPairingStep(3), 4000); // Synching Profile
    setTimeout(() => {
      setShowPairing(false);
      setPairingStep(0);
    }, 6000); // Done
  };

  return (
    <div>
      <div className="section-header">
        <div className="section-title">Dispositivos y Lentes YOLTIC</div>
        <div className="section-actions">
          <button 
            className="app-btn-primary" 
            onClick={startPairing}
          >
            + Emparejar Lentes
          </button>

        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-8">

        {/* Device Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 align-start">
          {loading ? (
            <div className="text-[var(--text-secondary)] font-bold animate-pulse">Cargando dispositivos...</div>
          ) : devices.length === 0 ? (
            <div className="glass-card p-8 text-center text-[var(--text-secondary)] col-span-full border-dashed">
              No hay dispositivos registrados en Firebase.
            </div>
          ) : devices.map(device => {
            const isTimeout = (now.getTime() - device.lastSeen.getTime()) > 30000;
            const computedStatus = isTimeout ? 'offline' : device.status;
            const signalStr = computedStatus === 'offline' ? "Sin señal" : "Excelente";
            
            let timeAgoStr = "Desconocido";
            if (device.lastSeen) {
              const diffSec = Math.floor((now.getTime() - device.lastSeen.getTime()) / 1000);
              if (diffSec < 10) timeAgoStr = "ahora";
              else if (diffSec < 60) timeAgoStr = `hace ${diffSec}s`;
              else if (diffSec < 3600) timeAgoStr = `hace ${Math.floor(diffSec / 60)}m`;
              else timeAgoStr = `${device.lastSeen.toLocaleDateString()}`;
            }

            return (
              <div key={device.id} className="glass-card p-4 hover:border-[var(--neon-green)]/30 transition-all">
                <div className="flex justify-between items-center mb-4">
                  <div className="font-extrabold text-white tracking-tight">{device.name}</div>
                  <div className={`w-2 h-2 rounded-full ${computedStatus === 'online' ? 'bg-emerald-500' : computedStatus === 'streaming' ? 'bg-cyan-500 animate-pulse' : 'bg-slate-700'}`} />
                </div>
                
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <div className="text-[9px] uppercase font-black text-[var(--text-dim)] tracking-widest mb-1">Batería</div>
                    <div className="mono-data text-xs font-bold text-white">
                      {computedStatus === 'offline' ? '--' : `${device.config?.volume ?? 100}%`}
                    </div>
                  </div>
                  <div>
                    <div className="text-[9px] uppercase font-black text-[var(--text-dim)] tracking-widest mb-1">Señal</div>
                    <div className={`mono-data text-xs font-bold ${computedStatus === 'offline' ? 'text-slate-500' : 'text-[var(--neon-green)]'}`}>
                      {signalStr}
                    </div>
                  </div>
                </div>

                <div className="h-[1px] bg-white/5 mb-4" />

                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-sm bg-white/5 border border-white/5 text-[var(--text-secondary)]">{device.firmware}</span>
                  <span className="text-[10px] font-bold text-[var(--text-dim)] uppercase">{timeAgoStr}</span>
                </div>
              </div>
            );
          })}
        </div>


        {/* Status Panel */}
        <div className="glass-card p-6 bg-slate-950/60 flex flex-col gap-6">
          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-dim)] border-b border-white/5 pb-4">
            System Middleware Status
          </div>
          
          <div>
            <div className="text-[9px] uppercase font-bold text-[var(--neon-green)] mb-1 opacity-70">Uptime Global</div>
            <div className="mono-data text-4xl font-black text-white tracking-tighter">
              99.98<span className="text-xs text-[var(--text-dim)] ml-1">%</span>
            </div>
          </div>
          
          <div className="flex flex-col gap-4">
            <div className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">Eventos de Red</div>
            <div className="flex flex-col gap-3">
              {MOCK_EVENTS.map((ev, i) => (
                <div key={i} className="flex gap-4 items-start group">
                  <div className="mono-data text-[10px] text-[var(--text-dim)] pt-0.5 group-hover:text-[var(--neon-green)] transition-colors">{ev.time}</div>
                  <div className="text-[11px] leading-relaxed text-[var(--text-secondary)] font-medium">{ev.msg}</div>
                </div>
              ))}
            </div>
          </div>
          
          <div className="mt-auto pt-4 border-t border-white/5">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-[var(--neon-green)] animate-pulse" />
              <span className="text-[10px] font-bold text-[var(--text-dim)] uppercase">Node_ISTMO_Active</span>
            </div>
          </div>
        </div>

      </div>

      {showPairing && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(0,0,0,0.8)", backdropFilter: "blur(4px)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999
        }}>
          <div className="card" style={{ width: 400, border: "1px solid var(--color-accent-glow)" }}>
            <div className="card-title" style={{ marginBottom: "var(--space-4)", textAlign: "center" }}>Pairing Wizard</div>
            
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)", margin: "var(--space-6) 0", alignItems: "center" }}>
              {pairingStep === 1 && <div style={{ color: "var(--color-warning)" }}>Buscando lentes por Bluetooth...</div>}
              {pairingStep === 2 && <div style={{ color: "var(--color-streaming)" }}>Conectado a la YOLTIC App. Intercambiando llaves...</div>}
              {pairingStep === 3 && <div style={{ color: "var(--color-success)" }}>Sincronizando Perfil de Usuario...</div>}
            </div>

            <div className="confidence-bar" style={{ height: 4, background: "var(--color-bg-elevated)", borderRadius: 2, overflow: "hidden" }}>
              <div className="confidence-fill confidence-fill--high" style={{ width: `${(pairingStep / 3) * 100}%` }} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
