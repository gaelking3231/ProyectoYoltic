import { motion } from "framer-motion";

interface StreamingIndicatorProps {
  isStreaming: boolean;
  deviceName?: string;
}

export default function StreamingIndicator({
  isStreaming,
  deviceName,
}: StreamingIndicatorProps) {
  return (
    <div className="flex items-center gap-3">
      {isStreaming && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20"
        >
          <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse shadow-[0_0_8px_rgba(129,140,248,0.6)]" />
          <span className="text-[10px] font-black text-indigo-300 uppercase tracking-widest">
            {deviceName || 'Terminal'} · UPLINK_ACTIVE
          </span>
        </motion.div>
      )}
      
      <div className={`px-3 py-1 rounded-full flex items-center gap-2 border ${
        isStreaming 
          ? "bg-[var(--neon-green)]/10 border-[var(--neon-green)]/20 text-[var(--neon-green)]" 
          : "bg-white/5 border-white/5 text-[var(--text-dim)]"
      }`}>
        <div className={`w-1.5 h-1.5 rounded-full ${isStreaming ? 'bg-[var(--neon-green)] shadow-[0_0_8px_var(--neon-glow)]' : 'bg-current opacity-30'}`} />
        <span className="text-[10px] font-black uppercase tracking-widest">
          {isStreaming ? 'Live' : 'Standby'}
        </span>
      </div>
    </div>
  );
}
