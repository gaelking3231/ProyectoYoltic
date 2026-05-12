"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Activity, 
  Cpu, 
  Globe, 
  Layers, 
  Settings, 
  Shield, 
  Database,
  Wifi,
  Smartphone,
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

export default function Dashboard() {
  const [activeSection, setActiveSection] = useState("live");
  const [isMounted, setIsMounted] = useState(false);
  
  useEffect(() => {
    setIsMounted(true);
  }, []);

  const { conversations } = useConversations(50);
  const { devices, loading: devicesLoading } = useDevices();
  const { isStreaming, streamingDevice } = useStreamingStatus();

  const completedCount = conversations.filter(
    (c) => c.status === "completed"
  ).length;
  const processingCount = conversations.filter(
    (c) => c.status === "processing" || c.status === "translating"
  ).length;
  const validConfs = conversations.filter((c) => c.status === "completed" && c.confidence > 0);
  const avgConfidence = validConfs.length > 0
    ? validConfs.reduce((sum, c) => sum + c.confidence, 0) / validConfs.length
    : 0;

  const displayConfidence = avgConfidence > 1 ? avgConfidence : avgConfidence * 100;

  const renderMainContent = () => {
    switch (activeSection) {
      case "dashboard":
      case "live":
        return (
          <>
            <div className="stats-grid">
              <StatCard
                value={String(conversations.length)}
                label="Total Conversaciones"
                trend="+12 hoy"
                trendUp={true}
              />
              <StatCard
                value={`${displayConfidence.toFixed(1)}%`}
                label="Confianza Promedio"
                trend="+2.3% vs ayer"
                trendUp={true}
              />
              <StatCard
                value={String(devices.filter((d) => d.status !== "offline").length)}
                label="Dispositivos Activos"
                trend={
                  devices.some((d) => d.status === "streaming")
                    ? "Streaming"
                    : "Idle"
                }
                trendUp={devices.some((d) => d.status === "streaming")}
              />
            </div>
            <LiveFeedView />
          </>
        );
      case "devices":
        return <DevicesView />;
      case "history":
        return <HistoryView />;
      case "dialects":
        return <DialectsView />;
      case "archive":
        return <ArchiveView />;
      case "settings":
        return <SettingsView />;
      case "security":
        return <SecurityView />;
      case "logs":
        return <LogsView />;
      default:
        return <LiveFeedView />;
    }
  };

  if (!isMounted) return null;

  return (
    <div className="relative min-h-screen bg-[var(--bg-deep)] text-[var(--text-primary)] flex overflow-hidden">
      {/* Background Decor */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-[var(--neon-green)] opacity-[0.03] blur-[120px] rounded-full animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-[var(--neon-cyan)] opacity-[0.03] blur-[120px] rounded-full" />
      </div>

      {/* ─── Sidebar (Floating Left) ────────────────────────── */}
      <motion.aside 
        initial={{ x: -100, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="w-64 h-screen border-r border-[var(--glass-border)] bg-slate-900/20 backdrop-blur-3xl z-20"
      >
        <Sidebar
          activeSection={activeSection}
          onSectionChange={setActiveSection}
          conversationCount={conversations.length}
          deviceCount={devices.length}
        />
      </motion.aside>

      {/* ─── Main Workspace ─────────────────────────────────── */}
      <main className="flex-1 h-screen flex flex-col overflow-hidden relative z-10">
        {/* Header Bar */}
        <motion.header 
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="h-16 flex items-center justify-between px-8 border-bottom border-[var(--glass-border)] bg-slate-950/40 backdrop-blur-md"
        >
          <div className="flex items-center gap-4">
            <div className="w-8 h-8 bg-gradient-to-br from-[var(--neon-green)] to-[var(--neon-cyan)] rounded-lg flex items-center justify-center font-bold text-slate-950 neon-shadow-green">
              Y
            </div>
            <div>
              <h1 className="text-sm font-extrabold tracking-tighter text-white uppercase">
                YOLTIC <span className="text-[var(--neon-green)]">SYSTEM</span>
              </h1>
              <p className="text-[10px] text-[var(--text-secondary)] font-medium tracking-widest uppercase">
                Bridging Zapotec Language • v2.0
              </p>
            </div>
          </div>

          <div className="flex items-center gap-8">
            <StreamingIndicator
              isStreaming={isStreaming}
              deviceName={streamingDevice?.name}
            />
            <div className="flex gap-6">
              <HeaderStat label="Traducciones" value={String(completedCount)} icon={<Activity size={14} />} />
              <HeaderStat
                label="Latencia"
                value="42ms"
                icon={<Cpu size={14} />}
              />
              <HeaderStat
                label="Precisión"
                value={`${displayConfidence.toFixed(0)}%`}
                icon={<Shield size={14} />}
              />
            </div>
          </div>
        </motion.header>

        {/* Content Area */}
        <section className="flex-1 overflow-y-auto p-8 hide-scrollbar">
          <motion.div
            key={activeSection}
            initial={{ opacity: 0, scale: 0.98, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 1.02 }}
            transition={{ duration: 0.4 }}
          >
            {renderMainContent()}
          </motion.div>
        </section>
      </main>

      {/* ─── Devices Sidebar (Floating Right) ───────────────── */}
      <motion.aside 
        initial={{ x: 100, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.8, delay: 0.4, ease: "easeOut" }}
        className="w-80 h-screen bg-slate-950/60 backdrop-blur-[60px] border-l border-[var(--glass-border)] relative z-20 shadow-[-20px_0_40px_rgba(0,0,0,0.5)]"
      >
        <div className="absolute top-0 left-0 w-[1px] h-full bg-gradient-to-b from-transparent via-[var(--neon-green)] to-transparent opacity-30" />
        <div className="p-6 h-full overflow-y-auto hide-scrollbar">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-xs font-black tracking-widest uppercase text-white flex items-center gap-2">
              <div className="w-1 h-3 bg-[var(--neon-green)] rounded-full" />
              Terminales
            </h2>
            <div className="mono-data text-[10px] text-[var(--neon-green)] animate-pulse">
              SYNC_ACTIVE
            </div>
          </div>
          <DevicePanel devices={devices} loading={devicesLoading} />
        </div>
      </motion.aside>
    </div>
  );
}

function HeaderStat({
  label,
  value,
  icon
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="p-2 rounded-lg bg-white/5 border border-white/5 text-[var(--text-secondary)]">
        {icon}
      </div>
      <div>
        <div className="mono-data text-sm font-bold text-white leading-none">
          {value}
        </div>
        <div className="text-[9px] text-[var(--text-dim)] uppercase font-bold tracking-tighter">
          {label}
        </div>
      </div>
    </div>
  );
}

function StatCard({
  value,
  label,
  trend,
  trendUp,
}: {
  value: string;
  label: string;
  trend: string;
  trendUp: boolean;
}) {
  return (
    <motion.div 
      whileHover={{ scale: 1.02, translateY: -4 }}
      className="glass-card p-6 relative overflow-hidden group"
    >
      {/* Accent Line */}
      <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-[var(--neon-green)] to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
      
      <div className="flex items-center justify-between mb-4">
        <span className="stat-label !mt-0 !text-[10px] tracking-widest">{label}</span>
        <div className={`p-1.5 rounded-md ${trendUp ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
          <ChevronRight size={14} className={trendUp ? '-rotate-90' : 'rotate-90'} />
        </div>
      </div>
      
      <div className="mono-data text-3xl font-bold text-white mb-2">
        {value}
      </div>
      
      <div className={`flex items-center gap-2 text-[10px] font-bold ${trendUp ? 'text-emerald-400' : 'text-rose-400'}`}>
        <span className="mono-data px-1.5 py-0.5 rounded-sm bg-white/5 border border-white/5">
          {trend}
        </span>
        <span className="text-white/20 uppercase tracking-tighter">vs periodo anterior</span>
      </div>
    </motion.div>
  );
}
