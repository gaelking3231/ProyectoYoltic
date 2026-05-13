"use client";

import { useState } from "react";
import { useConversations } from "@/lib/hooks";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import WaveformPlayer from "../WaveformPlayer";

export default function ArchiveView() {
  const { conversations, loading } = useConversations(1000);
  const [searchTerm, setSearchTerm] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [spanishEdits, setSpanishEdits] = useState<Record<string, string>>({});

  const filteredItems = conversations.filter(item => 
    (item.originalText || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
    (item.translatedText || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
    (item.corrected_text || "").toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleEditChange = (id: string, value: string) => {
    setEdits(prev => ({ ...prev, [id]: value }));
  };

  const handleSpanishEditChange = (id: string, value: string) => {
    setSpanishEdits(prev => ({ ...prev, [id]: value }));
  };

  const handleSaveCorrection = async (id: string, isRevert: boolean = false) => {
    const newText = isRevert ? null : (edits[id] !== undefined ? edits[id] : undefined);
    const newSpanishText = isRevert ? null : (spanishEdits[id] !== undefined ? spanishEdits[id] : undefined);
    
    if (!isRevert && (!newText || newText.trim() === "")) return;
    
    setSavingId(id);
    try {
      const docRef = doc(db, "translations", id);
      await updateDoc(docRef, {
        corrected_text: isRevert ? null : newText?.trim(),
        corrected_spanish: isRevert ? null : newSpanishText?.trim()
      });
      if (isRevert) {
        setEdits(prev => {
          const newEdits = { ...prev };
          delete newEdits[id];
          return newEdits;
        });
        setSpanishEdits(prev => {
          const newSpanishEdits = { ...prev };
          delete newSpanishEdits[id];
          return newSpanishEdits;
        });
      } else {
        setSavedId(id);
        setTimeout(() => setSavedId(null), 2000); // Feedback visual
      }
    } catch (error) {
      console.error("Error al guardar:", error);
      alert("Error de conexión al guardar.");
    }
    setSavingId(null);
  };

  const stats = {
    total: conversations.length,
    validados: conversations.filter(c => c.corrected_text || c.mode === 'WEB_STUDIO').length,
    pendientes: conversations.filter(c => !c.corrected_text && c.mode !== 'WEB_STUDIO').length,
  };

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <style>{`
        .dataset-table-container {
          background: var(--color-bg-primary);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-lg);
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }
        .validation-card {
          display: grid;
          grid-template-columns: 280px 1fr 1fr;
          gap: 24px;
          padding: 20px 24px;
          border-bottom: 1px solid var(--color-border);
          background: transparent;
          transition: background 0.2s;
        }
        .validation-card:hover {
          background: var(--color-bg-hover);
        }
        .validation-card.is-verified {
          background: rgba(16, 185, 129, 0.02);
        }
        .validation-card.is-verified:hover {
          background: rgba(16, 185, 129, 0.04);
        }
        
        .status-pill {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 4px 10px;
          border-radius: 4px;
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .status-pill.pending {
          background: rgba(245, 158, 11, 0.1);
          color: #fbbf24;
          border: 1px solid rgba(245, 158, 11, 0.2);
        }
        .status-pill.verified {
          background: rgba(16, 185, 129, 0.1);
          color: #34d399;
          border: 1px solid rgba(16, 185, 129, 0.2);
        }

        .data-label {
          font-size: 11px;
          color: var(--color-text-tertiary);
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin-bottom: 6px;
          font-weight: 600;
        }
        .data-value {
          font-size: 14px;
          color: var(--color-text-secondary);
          line-height: 1.5;
        }

        .edit-input {
          width: 100%;
          background: var(--color-bg-secondary);
          border: 1px solid var(--color-border);
          border-radius: 6px;
          padding: 10px 12px;
          color: var(--color-text-primary);
          font-family: var(--font-sans);
          font-size: 14px;
          transition: all 0.2s;
        }
        .edit-input:focus {
          outline: none;
          border-color: var(--color-accent);
          background: var(--color-bg-primary);
        }

        .action-btn {
          padding: 8px 16px;
          border-radius: 6px;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
          border: none;
        }
        .action-btn.primary {
          background: var(--color-accent);
          color: #fff;
        }
        .action-btn.primary:hover:not(:disabled) {
          filter: brightness(1.1);
        }
        .action-btn.primary:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .action-btn.danger {
          background: transparent;
          color: #ef4444;
          border: 1px solid rgba(239, 68, 68, 0.3);
        }
        .action-btn.danger:hover {
          background: rgba(239, 68, 68, 0.1);
        }

        .stats-dashboard {
          display: flex;
          gap: 32px;
          padding: 16px 24px;
          background: var(--color-bg-secondary);
          border-radius: var(--radius-lg);
          border: 1px solid var(--color-border);
          margin-bottom: 24px;
        }
        .stat-block {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .stat-num {
          font-size: 20px;
          font-weight: 600;
          color: var(--color-text-primary);
        }
        .stat-desc {
          font-size: 11px;
          color: var(--color-text-tertiary);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
      `}</style>

      <div className="section-header">
        <div className="section-title">Validación de Dataset</div>
        <div className="section-actions">
          <input 
            type="text" 
            placeholder="Filtrar registros..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input w-[280px]"
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6 mb-8">
        <div className="glass-card p-6 flex flex-col gap-1">
          <span className="text-[10px] font-black text-[var(--text-dim)] uppercase tracking-widest">Capturas Totales</span>
          <span className="mono-data text-3xl font-black text-white">{stats.total}</span>
        </div>
        <div className="glass-card p-6 flex flex-col gap-1 border-b-2 border-b-emerald-500/30">
          <span className="text-[10px] font-black text-emerald-500/50 uppercase tracking-widest">Validados</span>
          <span className="mono-data text-3xl font-black text-emerald-400">{stats.validados}</span>
        </div>
        <div className="glass-card p-6 flex flex-col gap-1 border-b-2 border-b-amber-500/30">
          <span className="text-[10px] font-black text-amber-500/50 uppercase tracking-widest">Pendientes</span>
          <span className="mono-data text-3xl font-black text-amber-400">{stats.pendientes}</span>
        </div>
      </div>

      <div className="glass-card flex-1 overflow-hidden flex flex-col">

        {loading ? (
          <div style={{ padding: "40px", textAlign: "center", color: "var(--color-text-secondary)", fontSize: "14px" }}>
            Cargando registros...
          </div>
        ) : filteredItems.length === 0 ? (
          <div style={{ padding: "40px", textAlign: "center", color: "var(--color-text-secondary)", fontSize: "14px" }}>
            No hay registros disponibles.
          </div>
        ) : filteredItems.map(item => {
          const isVerified = !!item.corrected_text || item.mode === 'WEB_STUDIO';
          const isSaving = savingId === item.id;
          const isSaved = savedId === item.id;
          const currentEdit = edits[item.id] !== undefined ? edits[item.id] : (item.corrected_text || "");

          return (
            <div key={item.id} className={`p-8 grid grid-cols-[280px_1fr_1fr] gap-8 border-b border-white/5 transition-colors ${isVerified ? 'bg-emerald-500/[0.02]' : 'hover:bg-white/[0.01]'}`}>
              {/* Columna Izquierda: Metadatos y Audio */}
              <div className="flex flex-col gap-6">
                <div className="flex justify-between items-center">
                  <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded border ${isVerified ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border-amber-500/20'}`}>
                    {isVerified ? "✓ Validado" : "⚡ Pendiente"}
                  </span>
                  <span className="mono-data text-[10px] text-[var(--text-dim)] font-bold">
                    {item.createdAt.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                  </span>
                </div>
                
                <div className="bg-slate-900/40 rounded-xl overflow-hidden border border-white/5 shadow-inner">
                  <WaveformPlayer audioUrl={item.audioUrl?.startsWith("data:") ? item.audioUrl : `${item.audioUrl}?t=${item.id}`} />
                </div>
                
                <div className="text-[10px] font-bold text-[var(--text-dim)] uppercase tracking-tighter opacity-60">
                  REF: {item.id.substring(0, 8)} • {item.metadata?.processingTimeMs || 0}MS
                </div>
              </div>

              {/* Columna Central: Datos Originales */}
              <div className="flex flex-col gap-6">
                <div>
                  <div className="text-[9px] font-black text-[var(--text-dim)] uppercase tracking-widest mb-2">Transcripción (Zapoteco)</div>
                  <div className="text-sm text-white font-medium italic">「{item.originalText || "—"}」</div>
                </div>
                <div>
                  <div className="text-[9px] font-black text-[var(--text-dim)] uppercase tracking-widest mb-2">Traducción LLM (Español)</div>
                  <div className="text-sm text-[var(--text-secondary)]">{item.translatedText || "—"}</div>
                </div>
              </div>

              {/* Columna Derecha: Validación */}
              <div className="flex flex-col gap-4 pl-8 border-l border-white/5">
                {isVerified ? (
                  <div className="flex-1 flex flex-col gap-6">
                    <div>
                      <div className="text-[9px] font-black text-emerald-500 uppercase tracking-widest mb-2">Corrección Oficial (ZAP)</div>
                      <div className="text-sm text-emerald-50 font-bold bg-emerald-500/10 p-3 rounded-lg border border-emerald-500/20">
                        {item.corrected_text || item.originalText}
                      </div>
                    </div>
                    {(item.corrected_spanish || (item.mode === 'WEB_STUDIO' && item.translatedText)) && (
                      <div>
                        <div className="text-[9px] font-black text-emerald-500/60 uppercase tracking-widest mb-2">Traducción Oficial (ESP)</div>
                        <div className="text-sm text-emerald-500 font-medium">
                          {item.corrected_spanish || item.translatedText}
                        </div>
                      </div>
                    )}
                    <div className="mt-auto">
                      <button 
                        onClick={() => handleSaveCorrection(item.id, true)} 
                        disabled={isSaving}
                        className="text-[10px] font-black text-rose-400 uppercase tracking-[0.15em] hover:text-rose-300 transition-colors"
                      >
                        {isSaving ? "REVIRTIENDO..." : "↩ REVERTIR A PENDIENTE"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col gap-4">
                    <div>
                      <div className="text-[9px] font-black text-white/40 uppercase tracking-widest mb-2">Corregir Zapoteco</div>
                      <textarea 
                        className="input w-full text-xs min-h-[60px]" 
                        placeholder="Escribe el Zapoteco correcto..." 
                        value={currentEdit}
                        onChange={(e) => handleEditChange(item.id, e.target.value)}
                      />
                    </div>
                    <div>
                      <div className="text-[9px] font-black text-white/40 uppercase tracking-widest mb-2">Corregir Español</div>
                      <textarea 
                        className="input w-full text-xs min-h-[60px]" 
                        placeholder="Significado real..." 
                        value={spanishEdits[item.id] || ""}
                        onChange={(e) => handleSpanishEditChange(item.id, e.target.value)}
                      />
                    </div>
                    <div className="mt-auto flex items-center gap-4">
                      <button 
                        onClick={() => handleSaveCorrection(item.id)} 
                        disabled={isSaving || !currentEdit.trim()}
                        className="app-btn-primary flex-1"
                      >
                        {isSaving ? "..." : "VALIDAR CAPTURA"}
                      </button>
                      {isSaved && <span className="text-[10px] font-black text-emerald-400 animate-pulse">¡LISTO!</span>}
                    </div>
                  </div>
                )}
              </div>
            </div>

          );
        })}
      </div>
    </div>
  );
}
