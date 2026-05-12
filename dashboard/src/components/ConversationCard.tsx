"use client";

import { useState } from "react";
import type { Conversation } from "@/lib/hooks";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

interface ConversationCardProps {
  conversation: Conversation;
}

export default function ConversationCard({ conversation }: ConversationCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [correction, setCorrection] = useState(conversation.corrected_text || "");
  const [isSaving, setIsSaving] = useState(false);

  const statusClass = `conversation-status conversation-status--${conversation.status}`;

  const statusLabels: Record<string, string> = {
    processing: "Procesando",
    translating: "Traduciendo…",
    completed: "Completado",
    error: "Error",
  };

  const dialectLabels: Record<string, string> = {
    valley: "Valle",
    isthmus: "Istmo",
    sierra_norte: "Sierra Norte",
    sierra_sur: "Sierra Sur",
  };

  const confidenceClass =
    conversation.confidence >= 0.8
      ? "confidence-fill--high"
      : conversation.confidence >= 0.5
      ? "confidence-fill--medium"
      : "confidence-fill--low";

  const timeAgo = getTimeAgo(conversation.createdAt);

  const playAudio = () => {
    if (conversation.audioUrl) {
      const audio = new Audio(conversation.audioUrl);
      audio.play();
    }
  };

  const saveCorrection = async () => {
    if (!correction.trim()) return;
    setIsSaving(true);
    try {
      const docRef = doc(db, "translations", conversation.id);
      await updateDoc(docRef, { corrected_text: correction });
      setIsEditing(false);
    } catch (err) {
      console.error("Error saving correction:", err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="conversation-card" id={`conversation-${conversation.id}`}>
      <div className="card-header">
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
          <span className={statusClass}>
            {conversation.status === "translating" && (
              <span style={{ display: "inline-block", animation: "dotPulse 1s infinite" }}>●</span>
            )}
            {statusLabels[conversation.status] || conversation.status}
          </span>
          <span className="dialect-badge">
            {dialectLabels[conversation.dialect] || conversation.dialect}
          </span>
          {conversation.mode && (
            <span style={{ fontSize: "10px", padding: "2px 6px", background: "rgba(255,255,255,0.1)", borderRadius: "4px" }}>
              {conversation.mode}
            </span>
          )}
        </div>

        {conversation.audioUrl && conversation.status === "completed" && (
          <button
            className="audio-btn"
            title="Reproducir audio"
            aria-label="Reproducir audio original"
            onClick={playAudio}
          >
            ▶
          </button>
        )}
      </div>

      {conversation.originalText && (
        <p className="conversation-text conversation-original">
          「{conversation.originalText}」
        </p>
      )}

      {conversation.translatedText && (
        <p className="conversation-text conversation-translation">
          {conversation.translatedText}
        </p>
      )}

      {conversation.corrected_text && !isEditing && (
        <div className="mt-4 p-3 bg-emerald-500/10 rounded-xl border-l-4 border-emerald-500">
          <p className="text-[10px] text-emerald-400 font-black uppercase tracking-widest mb-1">✓ Corrección Experta</p>
          <p className="text-sm text-white font-medium italic">"{conversation.corrected_text}"</p>
        </div>
      )}

      {isEditing ? (
        <div className="mt-4 flex gap-2">
          <input 
            type="text" 
            value={correction}
            onChange={(e) => setCorrection(e.target.value)}
            placeholder="Sugerir corrección..."
            className="flex-1 px-3 py-2 text-xs rounded-lg bg-black/40 border border-white/10 text-white outline-none focus:border-[var(--neon-green)]/50 transition-all"
          />
          <button 
            onClick={saveCorrection} 
            disabled={isSaving}
            className="px-4 py-2 rounded-lg bg-[var(--neon-green)] text-slate-950 text-[10px] font-black uppercase tracking-widest hover:brightness-110 disabled:opacity-50"
          >
            {isSaving ? "..." : "OK"}
          </button>
          <button 
            onClick={() => setIsEditing(false)}
            className="px-3 py-2 rounded-lg bg-white/5 text-white/60 hover:text-white border border-white/5 transition-colors"
          >
            ✕
          </button>
        </div>
      ) : (
        conversation.status === "completed" && (
          <button 
            onClick={() => setIsEditing(true)}
            className="mt-4 text-[10px] font-bold text-[var(--text-dim)] uppercase tracking-widest hover:text-[var(--neon-green)] transition-colors flex items-center gap-1.5"
          >
            <span className="text-xs">✎</span> {conversation.corrected_text ? "Modificar corrección" : "Sugerir corrección"}
          </button>
        )
      )}

      {conversation.error && (
        <p className="mt-3 text-xs text-rose-400 font-bold flex items-center gap-2">
          <span className="w-1.5 h-1.5 bg-rose-500 rounded-full animate-ping" />
          {conversation.error}
        </p>
      )}

      <div className="mt-6 flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-[var(--text-dim)] border-t border-white/5 pt-4">
        <div className="flex gap-4">
          <span>{timeAgo}</span>
          {conversation.audioDuration > 0 && (
            <span>{conversation.audioDuration.toFixed(1)}s</span>
          )}
          {conversation.metadata?.processingTimeMs > 0 && (
            <span className="text-[var(--neon-cyan)]">{conversation.metadata.processingTimeMs}ms</span>
          )}
        </div>
        {conversation.confidence > 0 && (
          <span className={conversation.confidence > 0.9 ? "text-[var(--neon-green)]" : "text-amber-400"}>
            CONF: {(conversation.confidence * 100).toFixed(0)}%
          </span>
        )}
      </div>

    </div>
  );
}

function getTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);

  if (diffSec < 10) return "ahora";
  if (diffSec < 60) return `${diffSec}s`;
  if (diffMin < 60) return `${diffMin}m`;
  if (diffHour < 24) return `${diffHour}h`;
  return date.toLocaleDateString("es-MX", { day: "numeric", month: "short" });
}
