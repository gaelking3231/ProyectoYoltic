"use client";

import { 
  LayoutDashboard, 
  Radio, 
  Smartphone, 
  History, 
  Globe, 
  Database, 
  Settings, 
  Shield, 
  ScrollText,
  User,
  Mic
} from "lucide-react";
import { motion } from "framer-motion";
import { useState } from "react";

interface SidebarProps {
  activeSection: string;
  onSectionChange: (section: string) => void;
  conversationCount: number;
  deviceCount: number;
}

export default function Sidebar({
  activeSection,
  onSectionChange,
  conversationCount,
  deviceCount,
}: SidebarProps) {
  return (
    <div className="flex flex-col h-full p-6">
      {/* Branding */}
      <div className="mb-10 px-2">
        <h2 className="text-[10px] font-black tracking-[0.2em] text-[var(--neon-green)] uppercase mb-1">
          Antigravity Engine
        </h2>
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-[var(--neon-green)] neon-shadow-green" />
          <span className="text-sm font-bold text-white tracking-tighter">PROJECT YOLTIC</span>
        </div>
      </div>

      {/* Main Navigation */}
      <div className="space-y-8 flex-1 overflow-y-auto hide-scrollbar">
        <NavSection title="Operaciones">
          <NavItem
            icon={<LayoutDashboard size={16} />}
            label="Dashboard"
            active={activeSection === "dashboard"}
            onClick={() => onSectionChange("dashboard")}
          />
          <NavItem
            icon={<Radio size={16} />}
            label="Live Feed"
            active={activeSection === "live"}
            onClick={() => onSectionChange("live")}
            badge={conversationCount > 0 ? String(conversationCount) : undefined}
          />
          <NavItem
            icon={<Smartphone size={16} />}
            label="Terminales"
            active={activeSection === "devices"}
            onClick={() => onSectionChange("devices")}
            badge={String(deviceCount)}
          />
        </NavSection>

        <NavSection title="Linguística">
          <NavItem
            icon={<Mic size={16} />}
            label="Studio de Voces"
            active={activeSection === "donar"}
            onClick={() => onSectionChange("donar")}
          />
          <NavItem
            icon={<History size={16} />}
            label="Historial"
            active={activeSection === "history"}
            onClick={() => onSectionChange("history")}
          />
          <NavItem
            icon={<Globe size={16} />}
            label="Glosario"
            active={activeSection === "dialects"}
            onClick={() => onSectionChange("dialects")}
          />
          <NavItem
            icon={<Database size={16} />}
            label="Dataset (ML)"
            active={activeSection === "archive"}
            onClick={() => onSectionChange("archive")}
          />
        </NavSection>

        <NavSection title="Configuración">
          <NavItem
            icon={<Settings size={16} />}
            label="Ajustes"
            active={activeSection === "settings"}
            onClick={() => onSectionChange("settings")}
          />
          <NavItem
            icon={<Shield size={16} />}
            label="Seguridad"
            active={activeSection === "security"}
            onClick={() => onSectionChange("security")}
          />
          <NavItem
            icon={<ScrollText size={16} />}
            label="Sistema Logs"
            active={activeSection === "logs"}
            onClick={() => onSectionChange("logs")}
          />
        </NavSection>
      </div>

      {/* Footer */}
      <div className="mt-auto pt-6 border-t border-white/5">
        <div className="flex items-center gap-3 p-2 rounded-xl bg-white/5 border border-white/5">
          <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center border border-white/10">
            <User size={14} className="text-white/60" />
          </div>
          <div>
            <div className="text-xs font-bold text-white">Investigador</div>
            <div className="text-[10px] text-[var(--text-dim)] font-medium uppercase">Admin Root</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function NavSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-[10px] font-bold text-[var(--text-dim)] uppercase tracking-widest mb-4 px-2">
        {title}
      </h3>
      <div className="space-y-1">
        {children}
      </div>
    </div>
  );
}

interface NavItemProps {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
  badge?: string;
}

function NavItem({ icon, label, active, onClick, badge }: NavItemProps) {
  return (
    <motion.div
      whileHover={{ x: 4 }}
      whileTap={{ scale: 0.98 }}
      className={`
        relative group flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all duration-300
        ${active ? 'bg-[var(--neon-green)]/10 text-white' : 'text-[var(--text-secondary)] hover:text-white hover:bg-white/5'}
      `}
      onClick={onClick}
    >
      {active && (
        <motion.div 
          layoutId="activeNav"
          className="absolute left-0 w-1 h-5 bg-[var(--neon-green)] rounded-full shadow-[0_0_10px_var(--neon-glow)]"
        />
      )}
      
      <div className={`${active ? 'text-[var(--neon-green)]' : 'text-inherit opacity-70 group-hover:opacity-100'}`}>
        {icon}
      </div>
      
      <span className={`text-sm font-medium flex-1 ${active ? 'font-bold' : ''}`}>
        {label}
      </span>

      {badge && (
        <span className="mono-data text-[10px] font-bold px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-[var(--text-dim)]">
          {badge}
        </span>
      )}
    </motion.div>
  );
}
