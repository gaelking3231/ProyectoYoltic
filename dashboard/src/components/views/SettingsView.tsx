"use client";

import { useState, useEffect } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Database } from "lucide-react";


export default function SettingsView() {
  const [anthropicKey, setAnthropicKey] = useState("");
  const [firebaseKey, setFirebaseKey] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function loadSettings() {
      try {
        const docRef = doc(db, "settings", "api_keys");
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.anthropic) setAnthropicKey(data.anthropic);
          if (data.firebase) setFirebaseKey(data.firebase);
        }
      } catch (err) {
        console.error("Error loading settings:", err);
      } finally {
        setLoading(false);
      }
    }
    loadSettings();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await setDoc(doc(db, "settings", "api_keys"), {
        anthropic: anthropicKey,
        firebase: firebaseKey
      }, { merge: true });
      alert("Configuración guardada en Firebase (settings/api_keys)");
    } catch (err) {
      console.error("Error saving settings:", err);
      alert("Error al guardar configuración");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="section-header">
        <div className="section-title">Configuración del Sistema</div>
        <div className="section-actions">
          <button 
            className="app-btn-primary" 
            onClick={handleSave}
            disabled={loading || saving}
            style={{ background: "var(--color-accent)", color: "#fff", border: "none", padding: "var(--space-2) var(--space-4)", borderRadius: "var(--radius-md)", cursor: "pointer", fontWeight: 600 }}
          >
            {saving ? "Guardando..." : "Guardar Cambios"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">

        
        {/* API Settings */}
        <div className="glass-card p-6">
          <div className="card-title text-white font-bold mb-6 flex items-center gap-2">
            <Database size={18} className="text-[var(--neon-green)]" />
            API y Conectividad
          </div>
          
          <div className="control-group mb-6">
            <label className="control-label mb-2 flex justify-between items-center text-[10px] uppercase tracking-widest text-[var(--text-secondary)] font-bold">
              <span>Anthropic API Key (Claude)</span>
              <span className={`flex items-center gap-2 ${anthropicKey ? 'text-emerald-400' : 'text-amber-400'}`}>
                <div className={`w-1.5 h-1.5 rounded-full ${anthropicKey ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'}`} /> 
                {anthropicKey ? "ACTIVO" : "FALTA LLAVE"}
              </span>
            </label>

            <input 
              type="password" 
              value={anthropicKey}
              onChange={(e) => setAnthropicKey(e.target.value)}
              className="select"
              placeholder="sk-ant-..."
              disabled={loading}
              style={{ fontFamily: "var(--font-mono)", background: "var(--color-bg-primary)" }}
            />
            <div style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-tertiary)", marginTop: "var(--space-1)" }}>
              Usado para procesar traducciones ultra-rápidas ZAP↔ESP. Las llamadas desde el frontend usarán esta llave.
            </div>
          </div>

          <div className="control-group mb-6">
            <label className="control-label mb-2 flex justify-between items-center text-[10px] uppercase tracking-widest text-[var(--text-secondary)] font-bold">
              <span>Firebase API Key (Backend)</span>
              <span className={`flex items-center gap-2 ${firebaseKey ? 'text-emerald-400' : 'text-amber-400'}`}>
                <div className={`w-1.5 h-1.5 rounded-full ${firebaseKey ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'}`} /> 
                {firebaseKey ? "ACTIVO" : "FALTA LLAVE"}
              </span>
            </label>

            <input 
              type="password" 
              value={firebaseKey}
              onChange={(e) => setFirebaseKey(e.target.value)}
              className="select"
              disabled={loading}
              placeholder="AIzaSyCz..."
              style={{ fontFamily: "var(--font-mono)", background: "var(--color-bg-primary)" }}
            />
          </div>

          <div className="control-group" style={{ marginTop: "var(--space-4)" }}>
            <label className="control-label" style={{ display: "flex", justifyContent: "space-between" }}>
              <span>Supabase API Key (Gamification/Tokens)</span>
              <span style={{ display: "flex", alignItems: "center", gap: 4, color: "var(--color-text-muted)" }}><div className="device-status-dot device-status-dot--offline" /> Pausado</span>
            </label>
            <input 
              type="password" 
              placeholder="Ingresa la API key de Supabase..."
              className="select"
              disabled={true}
              style={{ fontFamily: "var(--font-mono)", background: "var(--color-bg-primary)" }}
            />
          </div>
        </div>

        <div>
          {/* Profile */}
          <div className="glass-card p-6 mb-6">
            <div className="card-title text-white font-bold mb-6">Perfil del Investigador</div>
            <div style={{ display: "flex", gap: "var(--space-6)", alignItems: "center" }}>
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 border border-white/10 flex items-center justify-center text-2xl shadow-xl">👤</div>
              <div style={{ flex: 1 }}>
                <input type="text" defaultValue="Investigador Principal" className="select w-full mb-3" style={{ background: "var(--color-bg-primary)" }} />
                <input type="text" defaultValue="Departamento de Lingüística" className="select w-full" style={{ background: "var(--color-bg-primary)" }} />
              </div>
            </div>
          </div>


          {/* Interface */}
          <div className="glass-card p-6">
            <div className="card-title text-white font-bold mb-6">Interfaz</div>
            
            <div className="flex justify-between items-center mb-6">
              <div>
                <div className="text-sm font-bold text-white mb-1">Modo Oscuro (Glassmorphism)</div>
                <div className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider font-bold">Estética lineal obligatoria</div>
              </div>
              <input type="checkbox" defaultChecked className="w-5 h-5 accent-[var(--neon-green)] cursor-pointer" />
            </div>

            <div className="h-[1px] bg-white/5 mb-6" />

            <div className="flex justify-between items-center">
              <div>
                <div className="text-sm font-bold text-white mb-1">Filtro Antigravity UI</div>
                <div className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider font-bold">Ocultar errores de ruido [ERR_NOISE]</div>
              </div>
              <input type="checkbox" className="w-5 h-5 accent-[var(--neon-green)] cursor-pointer" />
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
