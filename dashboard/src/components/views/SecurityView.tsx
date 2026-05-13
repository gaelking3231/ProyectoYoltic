"use client";

export default function SecurityView() {
  return (
    <div>
      <div className="section-header">
        <div className="section-title">Seguridad y Control de Acceso</div>
        <div className="section-actions">
          <div className="px-3 py-1 bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 rounded text-[10px] font-bold tracking-widest uppercase">
            Fase 2 (Próximamente)
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: "var(--space-6)", opacity: 0.6, pointerEvents: "none" }}>
        
        {/* Encription Status */}
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
          <div className="card" style={{ textAlign: "center" }}>
            <div style={{ fontSize: "var(--font-size-3xl)", marginBottom: "var(--space-2)" }}>🛡️</div>
            <div style={{ fontSize: "var(--font-size-md)", fontWeight: 600, color: "var(--color-success)", marginBottom: "var(--space-1)" }}>
              Encriptación Activa
            </div>
            <div style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-secondary)" }}>
              Data-at-rest (AES-256) y Data-in-transit (TLS 1.3) mediante Antigravity Middleware.
            </div>
          </div>

          <div className="card">
            <div className="card-title" style={{ marginBottom: "var(--space-3)" }}>Roles de Usuario</div>
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "var(--space-2)", background: "var(--color-bg-elevated)", borderRadius: "var(--radius-md)", border: "1px solid var(--color-border-accent)" }}>
                <div>
                  <div style={{ fontSize: "var(--font-size-sm)", fontWeight: 500 }}>Investigador</div>
                  <div style={{ fontSize: "10px", color: "var(--color-text-tertiary)" }}>Acceso Total</div>
                </div>
                <div className="device-status-dot device-status-dot--online" />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "var(--space-2)", background: "var(--color-bg-primary)", borderRadius: "var(--radius-md)", border: "1px solid var(--color-border)" }}>
                <div>
                  <div style={{ fontSize: "var(--font-size-sm)", fontWeight: 500 }}>Admin IT</div>
                  <div style={{ fontSize: "10px", color: "var(--color-text-tertiary)" }}>Hardware configs</div>
                </div>
                <div style={{ fontSize: "var(--font-size-xs)" }}>...</div>
              </div>
            </div>
          </div>
        </div>

        {/* Access Logs */}
        <div className="card">
          <div className="card-title" style={{ marginBottom: "var(--space-4)" }}>Log de Accesos</div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "var(--font-size-xs)" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--color-border)", color: "var(--color-text-tertiary)", textAlign: "left" }}>
                <th style={{ padding: "var(--space-3)", fontWeight: 600 }}>Usuario</th>
                <th style={{ padding: "var(--space-3)", fontWeight: 600 }}>Evento</th>
                <th style={{ padding: "var(--space-3)", fontWeight: 600 }}>IP (Simulada)</th>
                <th style={{ padding: "var(--space-3)", fontWeight: 600 }}>Fecha / Hora</th>
              </tr>
            </thead>
            <tbody>
              {/* Dummy row 1 */}
              <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.02)" }}>
                <td style={{ padding: "var(--space-3)", fontWeight: 500 }}>Investigador</td>
                <td style={{ padding: "var(--space-3)" }}>Login exitoso</td>
                <td style={{ padding: "var(--space-3)", fontFamily: "var(--font-mono)", color: "var(--color-text-tertiary)" }}>192.168.1.104</td>
                <td style={{ padding: "var(--space-3)", color: "var(--color-text-secondary)" }}>Hoy 18:40:12</td>
              </tr>
              {/* Dummy row 2 */}
              <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.02)" }}>
                <td style={{ padding: "var(--space-3)", fontWeight: 500 }}>Sistema Antigravity</td>
                <td style={{ padding: "var(--space-3)" }}>Rotación de llaves AES</td>
                <td style={{ padding: "var(--space-3)", fontFamily: "var(--font-mono)", color: "var(--color-text-tertiary)" }}>Localhost</td>
                <td style={{ padding: "var(--space-3)", color: "var(--color-text-secondary)" }}>Hoy 12:00:00</td>
              </tr>
              {/* Dummy row 3 */}
              <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.02)" }}>
                <td style={{ padding: "var(--space-3)", fontWeight: 500 }}>Admin IT</td>
                <td style={{ padding: "var(--space-3)", color: "var(--color-warning)" }}>Intento fallido de acceso</td>
                <td style={{ padding: "var(--space-3)", fontFamily: "var(--font-mono)", color: "var(--color-text-tertiary)" }}>10.0.4.55</td>
                <td style={{ padding: "var(--space-3)", color: "var(--color-text-secondary)" }}>Ayer 22:15:30</td>
              </tr>
            </tbody>
          </table>
        </div>

      </div>
    </div>
  );
}
