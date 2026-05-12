"use client";

import { useState, useEffect } from "react";
import { collection, query, orderBy, limit, onSnapshot, DocumentData } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { motion, AnimatePresence } from "framer-motion";

interface LogEntry {
  id: string;
  time: string;
  type: string;
  msg: string;
  timestamp: Date;
}

export default function LogsView() {
  const [filterType, setFilterType] = useState("all");
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, "logs"),
      orderBy("timestamp", "desc"),
      limit(100)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const fetchedLogs: LogEntry[] = snapshot.docs.map(doc => {
          const data = doc.data() as DocumentData;
          return {
            id: doc.id,
            time: data.time || new Date().toISOString(),
            type: data.type || "System",
            msg: data.msg || "",
            timestamp: data.timestamp?.toDate?.() || new Date()
          };
        });
        setLogs(fetchedLogs);
        setLoading(false);
      },
      (err) => {
        console.error("Error fetching logs in realtime:", err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const filteredLogs = filterType === "all" ? logs : logs.filter(l => l.type === filterType);

  return (
    <div>
      <div className="section-header">
        <div className="section-title">System & Diagnostic Logs (Live)</div>
      </div>

      <div className="glass-card overflow-hidden">
        
        {/* Filters */}
        <div className="p-6 border-b border-white/5 flex gap-4 items-center">
          <select 
            className="select w-[200px]" 
            value={filterType} 
            onChange={e => setFilterType(e.target.value)}
          >
            <option value="all">Filtro: Todos</option>
            <option value="Antigravity">Antigravity</option>
            <option value="API">API</option>
            <option value="Connectivity">Conectividad</option>
            <option value="DB">Base de Datos</option>
          </select>
          <input 
            type="date" 
            className="select w-[160px]" 
            defaultValue={new Date().toISOString().split('T')[0]} 
          />
          <button className="app-btn-primary ml-auto flex items-center gap-2">
            Descargar CSV
          </button>
        </div>


        {/* Logs Table */}
        <div style={{ overflowX: "auto", maxHeight: "60vh" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px" }}>
            <thead>
              <tr style={{ background: "rgba(255,255,255,0.02)", color: "var(--color-text-tertiary)", textAlign: "left" }}>
                <th style={{ padding: "16px var(--space-4)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em" }}>ID</th>
                <th style={{ padding: "16px var(--space-4)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em" }}>Timestamp</th>
                <th style={{ padding: "16px var(--space-4)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em" }}>Type</th>
                <th style={{ padding: "16px var(--space-4)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em" }}>Message</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading ? (
                <tr><td colSpan={4} style={{ padding: "24px", textAlign: "center", color: "var(--color-text-tertiary)" }}>Esperando flujo de datos...</td></tr>
              ) : filteredLogs.length === 0 ? (
                <tr><td colSpan={4} style={{ padding: "24px", textAlign: "center", color: "var(--color-text-tertiary)" }}>No se encontraron logs con estos criterios.</td></tr>
              ) : (
                <AnimatePresence initial={false}>
                  {filteredLogs.map(log => (
                    <motion.tr 
                      key={log.id} 
                      className="hover:bg-white/[0.02] transition-colors"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                    >
                      <td style={{ padding: "12px var(--space-4)", color: "var(--color-text-dim)", fontFamily: "var(--font-mono)" }}>{log.id.substring(0, 8)}</td>
                      <td style={{ padding: "12px var(--space-4)", color: "var(--color-text-secondary)", fontFamily: "var(--font-mono)" }}>
                        {new Date(log.timestamp).toLocaleDateString()} <span className="opacity-50">{new Date(log.timestamp).toLocaleTimeString()}</span>
                      </td>
                      <td style={{ padding: "12px var(--space-4)" }}>
                        <span className="mono-data" style={{ 
                          padding: "2px 8px", 
                          borderRadius: "4px", 
                          fontSize: "10px",
                          fontWeight: 800,
                          background: log.type === "Antigravity" ? "rgba(139, 92, 246, 0.1)" : log.type === "API" ? "rgba(16, 185, 129, 0.1)" : log.type === "DB" ? "rgba(245, 158, 11, 0.1)" : "rgba(255,255,255,0.05)",
                          color: log.type === "Antigravity" ? "#A78BFA" : log.type === "API" ? "#34D399" : log.type === "DB" ? "#FBBF24" : "var(--color-text-secondary)",
                          border: "1px solid currentColor",
                          opacity: 0.8
                        }}>
                          {log.type.toUpperCase()}
                        </span>
                      </td>
                      <td style={{ padding: "12px var(--space-4)", color: log.msg.includes("ERR") ? "#fb7185" : "white", fontWeight: log.msg.includes("ERR") ? 700 : 400 }}>
                        {log.msg}
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              )}
            </tbody>
          </table>
        </div>


      </div>
    </div>
  );
}
