"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Device } from "@/lib/hooks";
import { Cpu, Wifi, Settings, Signal, Database } from "lucide-react";

interface DevicePanelProps {
  devices: Device[];
  loading: boolean;
}

export default function DevicePanel({ devices, loading }: DevicePanelProps) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-6">
        <span className="text-[10px] font-black tracking-widest text-[var(--text-dim)] uppercase">Terminales Conectadas</span>
        <span className="mono-data text-[10px] text-[var(--neon-green)] font-bold px-2 py-0.5 rounded bg-[var(--neon-green)]/10">
          {devices.filter((d) => d.status !== "offline").length}/{devices.length} LIVE
        </span>
      </div>

      <div className="space-y-4 flex-1">
        {loading ? (
          <div className="space-y-4">
            {[1, 2].map((i) => (
              <div key={i} className="h-48 rounded-2xl bg-white/5 animate-pulse border border-white/5" />
            ))}
          </div>
        ) : devices.length > 0 ? (
          <AnimatePresence mode="popLayout">
            {devices.map((device) => (
              <DeviceCard key={device.id} device={device} />
            ))}
          </AnimatePresence>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Signal size={32} className="text-white/10 mb-4" />
            <p className="text-xs font-bold text-white/40 uppercase tracking-widest">No hay dispositivos en el nodo</p>
          </div>
        )}
      </div>

      {/* Quick Specs */}
      <div className="mt-8 pt-6 border-t border-white/5">
        <h4 className="text-[9px] font-black text-white/40 uppercase tracking-[0.2em] mb-4">Parámetros de Red</h4>
        <div className="space-y-3">
          <SpecRow label="PROTOCOLO" value="BLE 5.0 + QUIC" icon={<Wifi size={10} />} />
          <SpecRow label="LATENCIA" value="< 42ms" icon={<Cpu size={10} />} />
          <SpecRow label="ENCODING" value="WAV PCM 16-BIT" icon={<Database size={10} />} />
          <SpecRow label="BANDWIDTH" value="1.2 MB/s" icon={<Signal size={10} />} />
        </div>
      </div>
    </div>
  );
}

function DeviceCard({ device }: { device: Device }) {
  const [volume, setVolume] = useState(device.config.volume);
  const [dialect, setDialect] = useState(device.config.dialect);

  const statusLabels: Record<string, string> = {
    online: "READY",
    offline: "OFFLINE",
    streaming: "STREAMING",
  };

  const statusColors: Record<string, string> = {
    online: "var(--neon-cyan)",
    offline: "var(--text-dim)",
    streaming: "var(--neon-green)",
  };

  async function handleVolumeChange(newVolume: number) {
    setVolume(newVolume);
    try {
      await updateDoc(doc(db, "dispositivos", device.id), {
        "config.volume": newVolume,
      });
    } catch (e) {}
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={`glass-card p-5 group relative ${device.status === 'streaming' ? 'border-[var(--neon-green)]/30' : ''}`}
    >
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-xs font-black text-white uppercase tracking-wider">{device.name}</h3>
          <p className="text-[10px] mono-data text-[var(--text-dim)] uppercase">{device.type} · ESP32-S3</p>
        </div>
        <div className="px-2 py-0.5 rounded text-[10px] font-black mono-data border border-white/10 bg-white/5 text-white/40">
          v{device.firmware}
        </div>
      </div>

      <div className="flex items-center gap-3 mb-6">
        <div className={`w-2 h-2 rounded-full ${device.status === 'streaming' ? 'animate-pulse' : ''}`} 
             style={{ backgroundColor: statusColors[device.status], boxShadow: `0 0 10px ${statusColors[device.status]}` }} />
        <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: statusColors[device.status] }}>
          {statusLabels[device.status]}
        </span>
      </div>

      <div className="space-y-4">
        {/* Slider */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <label className="text-[9px] font-bold text-[var(--text-dim)] uppercase tracking-tighter">Gain Control</label>
            <span className="mono-data text-[10px] font-bold text-white">{volume}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            value={volume}
            onChange={(e) => handleVolumeChange(Number(e.target.value))}
            className="w-full h-1 bg-white/10 rounded-full appearance-none cursor-pointer accent-[var(--neon-green)]"
          />
        </div>

        {/* Dialect */}
        <div className="flex items-center justify-between p-2 rounded-lg bg-black/40 border border-white/5">
          <label className="text-[9px] font-bold text-[var(--text-dim)] uppercase px-1">Léxico</label>
          <select
            value={dialect}
            className="bg-transparent text-[10px] font-bold text-white outline-none cursor-pointer"
            onChange={(e) => setDialect(e.target.value)}
          >
            <option value="isthmus">Zapoteco Istmo</option>
            <option value="valley">Zapoteco Valle</option>
          </select>
        </div>
      </div>
    </motion.div>
  );
}

function SpecRow({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between group/row">
      <div className="flex items-center gap-2">
        <div className="text-[var(--text-dim)] group-hover/row:text-[var(--neon-green)] transition-colors">
          {icon}
        </div>
        <span className="text-[9px] font-bold text-[var(--text-dim)] tracking-tighter uppercase">{label}</span>
      </div>
      <span className="mono-data text-[10px] font-bold text-white/60 tracking-tight">{value}</span>
    </div>
  );
}
