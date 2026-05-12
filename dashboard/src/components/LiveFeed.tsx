"use client";

import { useConversations, useStreamingStatus } from "@/lib/hooks";
import AudioWaveform from "./AudioWaveform";
import ConversationCard from "./ConversationCard";
import { motion, AnimatePresence } from "framer-motion";

export default function LiveFeed() {
  const { conversations, loading } = useConversations(50);
  const { isStreaming } = useStreamingStatus();

  return (
    <div>
      {/* Live Feed Header */}
      <div className="section-header">
        <div className="live-feed-header">
          <div className="live-dot" />
          <span className="live-label">Live Feed</span>
          <span
            style={{
              fontSize: "var(--font-size-xs)",
              color: "var(--color-text-tertiary)",
              marginLeft: "var(--space-2)",
            }}
          >
            {conversations.length} traducciones
          </span>
        </div>
      </div>

      {/* Audio Waveform Visualization */}
      <AudioWaveform isStreaming={isStreaming} />

      {/* Conversation List */}
      <div
        className="glass-card mt-6 overflow-hidden"
        style={{
          maxHeight: "calc(100vh - 360px)",
          overflowY: "auto",
        }}
      >
        {loading ? (
          <div className="p-6 space-y-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-24 bg-white/5 animate-pulse rounded-xl"
              />
            ))}
          </div>
        ) : conversations.length > 0 ? (
          <AnimatePresence initial={false}>
            <div className="divide-y divide-white/5">
              {conversations.map((conv) => (
                <motion.div
                  key={conv.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  transition={{ duration: 0.3 }}
                >
                  <ConversationCard conversation={conv} />
                </motion.div>
              ))}
            </div>
          </AnimatePresence>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 px-10 text-center">
            <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center text-3xl mb-6 grayscale opacity-50">🔇</div>
            <div className="text-white font-bold text-lg mb-2 tracking-tight">Sin señales de audio</div>
            <div className="text-[var(--text-secondary)] text-sm max-w-xs leading-relaxed font-medium">
              Activa los lentes YOLTIC. El flujo de datos aparecerá aquí automáticamente.
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
