"use client";

import { useState } from "react";
import { useConversations } from "@/lib/hooks";

export default function HistoryView() {
  const [searchTerm, setSearchTerm] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [dialectFilter, setDialectFilter] = useState("");
  const [confFilter, setConfFilter] = useState("");
  
  const { conversations, loading } = useConversations(50);

  const filtered = conversations.filter(h => {
    const zapMatch = h.originalText?.toLowerCase().includes(searchTerm.toLowerCase());
    const espMatch = h.translatedText?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSearch = zapMatch || espMatch;

    const matchesDialect = dialectFilter ? h.dialect === dialectFilter : true;
    const matchesConf = confFilter ? (h.confidence * 100) >= parseInt(confFilter, 10) : true;
    
    // Simple date filter (mock logical check)
    let matchesDate = true;
    if (dateFilter) {
      const now = new Date();
      const diffMs = now.getTime() - h.createdAt.getTime();
      const diffDays = diffMs / (1000 * 60 * 60 * 24);
      if (dateFilter === "today" && diffDays > 1) matchesDate = false;
      if (dateFilter === "yesterday" && (diffDays <= 1 || diffDays > 2)) matchesDate = false;
      if (dateFilter === "week" && diffDays > 7) matchesDate = false;
    }

    return matchesSearch && matchesDialect && matchesConf && matchesDate;
  });

  return (
    <div>
      <div className="section-header">
        <div className="section-title">Historial de Traducciones</div>
      </div>

      <div className="glass-card p-6">
        {/* Filters Top Bar */}
        <div className="flex gap-4 mb-8">
          <input 
            type="text" 
            placeholder="Buscar en traducciones..." 
            className="input flex-1"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <select className="select w-[160px]" value={dateFilter} onChange={e => setDateFilter(e.target.value)}>
            <option value="">Fecha: Todas</option>
            <option value="today">Hoy</option>
            <option value="yesterday">Ayer</option>
            <option value="week">Esta semana</option>
          </select>
          <select className="select w-[160px]" value={dialectFilter} onChange={e => setDialectFilter(e.target.value)}>
            <option value="">Dialecto: Todos</option>
            <option value="isthmus">Istmo</option>
            <option value="valley">Valle</option>
            <option value="sierra_norte">Sierra N.</option>
            <option value="sierra_sur">Sierra S.</option>
          </select>
          <select className="select w-[160px]" value={confFilter} onChange={e => setConfFilter(e.target.value)}>
            <option value="">Precisión: Todas</option>
            <option value="95">&gt;95%</option>
            <option value="80">&gt;80%</option>
          </select>
        </div>


        {/* Table */}
        <div style={{ overflowX: "auto", maxHeight: "65vh", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "var(--font-size-sm)", minWidth: "900px" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--color-border)", color: "var(--color-text-tertiary)", textAlign: "left", background: "rgba(255,255,255,0.01)" }}>
                <th style={{ padding: "var(--space-3)", fontWeight: 600, width: "180px" }}>Fecha/Hora</th>
                <th style={{ padding: "var(--space-3)", fontWeight: 600, width: "25%" }}>[ZAP] Zapoteco</th>
                <th style={{ padding: "var(--space-3)", fontWeight: 600, width: "25%" }}>[ESP] Español</th>
                <th style={{ padding: "var(--space-3)", fontWeight: 600, width: "120px" }}>Dialecto</th>
                <th style={{ padding: "var(--space-3)", fontWeight: 600, width: "100px" }}>Dispositivo</th>
                <th style={{ padding: "var(--space-3)", fontWeight: 600, width: "150px" }}>Confianza</th>
                <th style={{ padding: "var(--space-3)", fontWeight: 600, width: "60px" }}>Audio</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr><td colSpan={7} style={{ padding: "var(--space-4)", textAlign: "center", color: "var(--color-text-secondary)" }}>Cargando traducciones...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} style={{ padding: "var(--space-4)", textAlign: "center", color: "var(--color-text-secondary)" }}>No hay traducciones que coincidan con los filtros.</td></tr>
              ) : filtered.map(row => (
                <tr key={row.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.02)", transition: "background 0.2s" }} onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'} onMouseOut={e => e.currentTarget.style.background = 'transparent'}>
                  <td style={{ padding: "var(--space-3)", fontFamily: "var(--font-mono)", color: "var(--color-text-tertiary)", fontSize: "11px", lineHeight: "1.2" }}>
                    {new Date(row.createdAt).toLocaleDateString()}<br/>
                    <span style={{ color: "var(--color-text-secondary)" }}>{new Date(row.createdAt).toLocaleTimeString()}</span>
                  </td>

                  <td style={{ padding: "var(--space-3)" }}>{row.originalText}</td>
                  <td style={{ padding: "var(--space-3)", color: "var(--color-text-secondary)" }}>{row.translatedText}</td>
                  <td style={{ padding: "var(--space-3)" }}><span className="dialect-badge">{row.dialect}</span></td>
                  <td style={{ padding: "var(--space-3)", fontFamily: "var(--font-mono)", fontSize: "var(--font-size-xs)" }}>{row.deviceId || "API"}</td>
                  <td style={{ padding: "var(--space-3)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <span style={{ fontSize: "var(--font-size-xs)", width: "30px" }}>{row.confidence}%</span>
                      <div className="confidence-bar" style={{ width: 40, marginTop: 0, height: 4 }}>
                        <div className={`confidence-fill ${row.confidence > 90 ? 'confidence-fill--high' : row.confidence > 70 ? 'confidence-fill--medium' : 'confidence-fill--low'}`} style={{ width: `${row.confidence}%` }} />
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: "var(--space-3)" }}>
                    <button className="audio-btn" aria-label="Reproducir Audio" disabled={!row.audioUrl}>▶</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
