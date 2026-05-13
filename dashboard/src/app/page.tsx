"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Activity, 
  Cpu, 
  Shield, 
  ChevronRight
} from "lucide-react";
import { useConversations, useDevices, useStreamingStatus } from "@/lib/hooks";
import Sidebar from "@/components/Sidebar";
import DevicePanel from "@/components/DevicePanel";
import StreamingIndicator from "@/components/StreamingIndicator";

// Views
import LiveFeedView from "@/components/views/LiveFeedView";
import DevicesView from "@/components/views/DevicesView";
import HistoryView from "@/components/views/HistoryView";
import DialectsView from "@/components/views/DialectsView";
import ArchiveView from "@/components/views/ArchiveView";
import SettingsView from "@/components/views/SettingsView";
import SecurityView from "@/components/views/SecurityView";
import LogsView from "@/components/views/LogsView";
import DonationView from "@/components/views/DonationView";

export default function Dashboard() {
  const [activeSection, setActiveSection] = useState("live");
  const [isMounted, setIsMounted] = useState(false);
  
  useEffect(() => {
    setIsMounted(true);
  }, []);

  const { conversations } = useConversations(1000);
  const { devices, loading: devicesLoading } = useDevices();
  const { isStreaming, streamingDevice } = useStreamingStatus();

  const completedCount = conversations.filter((c) => c.status === "completed").length;
  const processingCount = conversations.filter((c) => c.status === "processing" || c.status === "translating").length;
  
  // Cálculo de confianza: asume 85% para audios viejos sin registro, usa valor real para nuevos.
  const validConfs = conversations.filter((c) => c.status === "completed");
  const avgConfidence = validConfs.length > 0 
    ? validConfs.reduce((sum, c) => sum + (c.confidence > 0 ? c.confidence : 0.85), 0) / validConfs.length 
    : 0.85;
  const displayConfidence = avgConfidence > 1 ? avgConfidence : avgConfidence * 100;

  const renderMainContent = () => {
    switch (activeSection) {
      case "dashboard":
      case "live":
        return (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mb-6">
              <StatCard value={String(conversations.length)} label="Total Conversaciones" trend="+12 hoy" trendUp={true} />
              <StatCard value={`${displayConfidence.toFixed(1)}%`} label="Confianza Promedio" trend="+2.3% vs ayer" trendUp={true} />
              <StatCard 
                value={String(devices.filter((d) => d.status !== "offline").length)} 
                label="Dispositivos Activos" 
                trend={devices.some((d) => d.status === "streaming") ? "Streaming" : "Idle"} 
                trendUp={devices.some((d) => d.status === "streaming")} 
              />
            </div>
            <LiveFeedView />
          </>
        );
      case "devices": return <DevicesView />;
      case "history": return <HistoryView />;
      case "dialects": return <DialectsView />;
      case "archive": return <ArchiveView />;
      case "donar": return <DonationView />;
      case "settings": return <SettingsView />;
      case "security": return <SecurityView />;
      case "logs": return <LogsView />;
      default: return <LiveFeedView />;
    }
  };

  if (!isMounted) return null;

  return (
    <div className="relative min-h-screen bg-[#020617] text-slate-200 flex overflow-hidden">
      {/* ─── Sidebar Izquierdo (Responsivo) ─── */}
      <Sidebar
        activeSection={activeSection}
        onSectionChange={setActiveSection}
        conversationCount={conversations.length}
        deviceCount={devices.length}
      />

      {/* ─── Workspace Principal ─── */}
      <main className="flex-1 h-screen flex flex-col overflow-hidden relative z-10 w-full">
        {/* Header Bar */}
        <header className="h-16 flex items-center justify-between px-4 sm:px-8 border-b border-white/5 bg-slate-950/40 backdrop-blur-md shrink-0">
          <div className="flex items-center gap-3 sm:gap-4 pl-12 lg:pl-0">
            <div className="hidden sm:flex w-8 h-8 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-lg items-center justify-center font-bold text-slate-950 shadow-[0_0_15px_rgba(6,182,212,0.3)]">
              Y
            </div>
            <div>
              <h1 className="text-xs sm:text-sm font-black tracking-tighter text-white uppercase">
                YOLTIC <span className="text-cyan-400 font-bold">SYSTEM</span>
              </h1>
              <p className="hidden sm:block text-[9px] text-white/40 font-medium tracking-widest uppercase">
                Bridging Zapotec Language
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 sm:gap-8">
            <StreamingIndicator isStreaming={isStreaming} deviceName={streamingDevice?.name} />
            <div className="hidden md:flex gap-6">
              <HeaderStat label="Traducciones" value={String(completedCount)} icon={<Activity size={14} />} />
              <HeaderStat label="Precisión" value={`${displayConfidence.toFixed(0)}%`} icon={<Shield size={14} />} />
            </div>
          </div>
        </header>

        {/* Content Area */}
        <section className="flex-1 overflow-y-auto p-4 sm:p-8 custom-scrollbar bg-slate-950/20">
          <motion.div
            key={activeSection}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="h-full"
          >
            {renderMainContent()}
          </motion.div>
        </section>
      </main>

      {/* ─── Sidebar Derecho (Terminales - Oculto en móvil) ─── */}
      <aside className="hidden xl:block w-80 h-screen bg-slate-950/40 backdrop-blur-3xl border-l border-white/5 relative z-20">
        <div className="p-6 h-full overflow-y-auto custom-scrollbar">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-xs font-black tracking-widest uppercase text-white flex items-center gap-2">
              <div className="w-1 h-3 bg-cyan-500 rounded-full" />
              Terminales
            </h2>
            <div className="text-[10px] text-cyan-400 font-mono animate-pulse uppercase">
              Live
            </div>
          </div>
          <DevicePanel devices={devices} loading={devicesLoading} />
        </div>
      </aside>
    </div>
  );
}

function HeaderStat({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <div className="p-2 rounded-lg bg-white/5 border border-white/5 text-white/40">
        {icon}
      </div>
      <div>
        <div className="text-sm font-bold text-white leading-none font-mono">
          {value}
        </div>
        <div className="text-[9px] text-white/40 uppercase font-bold tracking-tighter">
          {label}
        </div>
      </div>
    </div>
  );
}

function StatCard({ value, label, trend, trendUp }: { value: string; label: string; trend: string; trendUp: boolean }) {
  return (
    <motion.div 
      whileHover={{ y: -2 }}
      className="bg-slate-900/40 border border-white/5 p-5 rounded-2xl relative overflow-hidden group"
    >
      <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-cyan-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
      <div className="flex items-center justify-between mb-4">
        <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">{label}</span>
        <div className={`p-1 rounded-md ${trendUp ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
          <ChevronRight size={12} className={trendUp ? '-rotate-90' : 'rotate-90'} />
        </div>
      </div>
      <div className="text-3xl font-black text-white mb-2 tracking-tighter">
        {value}
      </div>
      <div className={`flex items-center gap-2 text-[10px] font-bold ${trendUp ? 'text-emerald-400' : 'text-rose-400'}`}>
        <span className="px-1.5 py-0.5 rounded bg-white/5 border border-white/5 font-mono">
          {trend}
        </span>
      </div>
    </motion.div>
  );
}
