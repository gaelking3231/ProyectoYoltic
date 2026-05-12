"use client";

const MOCK_DIALECTS = [
  { id: "zap_istmo", name: "Zapoteco del Istmo", status: "Active - v2.1.0", vocab: 45200, freq: 85, trainMsg: "Actualizado hoy" },
  { id: "zap_valle", name: "Zapoteco del Valle", status: "Active - v1.9.4", vocab: 28500, freq: 40, trainMsg: "Último entreno hace 3 d" },
  { id: "zap_sierra", name: "Zapoteco de la Sierra", status: "Training (78%)", vocab: 12000, freq: 12, trainMsg: "Entrenando Modelo 3.5 Sonnet..." },
];

export default function DialectsView() {
  return (
    <div>
      <div className="section-header">
        <div className="section-title">Modelos Lingüísticos por Dialecto</div>
        <div className="section-actions">
          <button 
            style={{
              background: "transparent",
              color: "var(--color-text-primary)",
              border: "1px solid var(--color-border)",
              padding: "var(--space-2) var(--space-4)",
              borderRadius: "var(--radius-md)",
              cursor: "pointer",
              fontSize: "var(--font-size-sm)"
            }}
          >
            Sincronizar Cloud
          </button>
        </div>
      </div>

      <div style={{ display: "grid", gap: "var(--space-4)" }}>
        {MOCK_DIALECTS.map(dialect => (
          <div key={dialect.id} className="glass-card" style={{ display: "flex", alignItems: "center", gap: "var(--space-8)", padding: "var(--space-6)" }}>
            {/* Header info */}
            <div style={{ minWidth: 220 }}>
              <div style={{ fontSize: "var(--font-size-lg)", fontWeight: 800, marginBottom: "var(--space-1)", color: "white" }}>{dialect.name}</div>
              <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", fontSize: "11px" }}>
                <div className={`w-2 h-2 rounded-full ${dialect.status.includes('Active') ? 'bg-emerald-500' : 'bg-cyan-500 animate-pulse'}`} />
                <span style={{ color: "var(--color-text-secondary)", fontWeight: 600 }}>{dialect.status}</span>
              </div>
              <div style={{ marginTop: "var(--space-3)", fontSize: "10px", color: "var(--color-text-tertiary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                {dialect.trainMsg}
              </div>
            </div>

            {/* Vocab Graph */}
            <div style={{ flex: 1.5 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", fontSize: "10px", marginBottom: "var(--space-2)", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--color-text-secondary)" }}>
                <span style={{ fontWeight: 700 }}>Tamaño de Vocabulario</span>
                <span className="mono-data" style={{ color: "var(--neon-cyan)", fontSize: "14px", fontWeight: 800 }}>{dialect.vocab.toLocaleString()}</span>
              </div>
              <div style={{ height: 6, background: "rgba(255,255,255,0.05)", borderRadius: 3, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${(dialect.vocab / 50000) * 100}%`, background: "linear-gradient(90deg, #3B82F6, var(--neon-cyan))", borderRadius: 3 }} />
              </div>
            </div>

            {/* Usage Graph */}
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", fontSize: "10px", marginBottom: "var(--space-2)", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--color-text-secondary)" }}>
                <span style={{ fontWeight: 700 }}>Uso Global</span>
                <span className="mono-data" style={{ color: "var(--neon-green)", fontSize: "14px", fontWeight: 800 }}>{dialect.freq}%</span>
              </div>
              <div style={{ height: 6, background: "rgba(255,255,255,0.05)", borderRadius: 3, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${dialect.freq}%`, background: "linear-gradient(90deg, var(--neon-green), #34D399)", borderRadius: 3 }} />
              </div>
            </div>


            {/* Actions */}
            <div>
              <button style={{
                  background: "var(--color-bg-tertiary)",
                  color: "var(--color-text-primary)",
                  border: "1px solid var(--color-border)",
                  padding: "var(--space-2) var(--space-3)",
                  borderRadius: "var(--radius-md)",
                  cursor: "pointer",
                  fontSize: "var(--font-size-xs)"
              }}>Configurar IA</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
