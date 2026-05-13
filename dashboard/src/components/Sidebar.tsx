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
  Mic,
  Menu,
  X
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";

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
  const [isOpen, setIsOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Detectar si es móvil para ocultar el sidebar por defecto
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024);
      if (window.innerWidth >= 1024) setIsOpen(true);
      else setIsOpen(false);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const handleNavClick = (section: string) => {
    onSectionChange(section);
    if (isMobile) setIsOpen(false);
  };

  return (
    <>
      {/* Botón Flotante para Móvil */}
      {isMobile && (
        <button 
          onClick={() => setIsOpen(!isOpen)}
          className="fixed top-4 left-4 z-[100] p-3 rounded-2xl bg-black/80 border border-white/10 text-white shadow-2xl backdrop-blur-xl"
        >
          {isOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      )}

      {/* Overlay para cerrar al tocar fuera en móvil */}
      <AnimatePresence>
        {isMobile && isOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[80]"
          />
        )}
      </AnimatePresence>

      {/* Sidebar Principal */}
      <motion.div 
        initial={false}
        animate={{ 
          x: isOpen ? 0 : -320,
          opacity: isOpen ? 1 : 0
        }}
        className={`
          fixed lg:relative z-[90] h-full w-[280px] flex flex-col bg-slate-950/50 lg:bg-transparent backdrop-blur-2xl lg:backdrop-blur-0 border-r border-white/5 lg:border-none
          transition-all duration-300 ease-in-out
        `}
      >
        <div className="flex flex-col h-full p-6 pt-20 lg:pt-6">
          {/* Branding */}
          <div className="mb-10 px-2">
            <h2 className="text-[10px] font-black tracking-[0.2em] text-cyan-400 uppercase mb-1">
              Antigravity Engine
            </h2>
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(6,182,212,1)]" />
              <span className="text-sm font-bold text-white tracking-tighter">PROJECT YOLTIC</span>
            </div>
          </div>

          {/* Navigation */}
          <div className="space-y-8 flex-1 overflow-y-auto custom-scrollbar pr-2">
            <NavSection title="Operaciones">
              <NavItem
                icon={<LayoutDashboard size={16} />}
                label="Dashboard"
                active={activeSection === "dashboard"}
                onClick={() => handleNavClick("dashboard")}
              />
              <NavItem
                icon={<Radio size={16} />}
                label="Live Feed"
                active={activeSection === "live"}
                onClick={() => handleNavClick("live")}
                badge={conversationCount > 0 ? String(conversationCount) : undefined}
              />
              <NavItem
                icon={<Smartphone size={16} />}
                label="Terminales"
                active={activeSection === "devices"}
                onClick={() => handleNavClick("devices")}
                badge={String(deviceCount)}
              />
            </NavSection>

            <NavSection title="Linguística">
              <NavItem
                icon={<Mic size={16} />}
                label="Studio de Voces"
                active={activeSection === "donar"}
                onClick={() => handleNavClick("donar")}
              />
              <NavItem
                icon={<History size={16} />}
                label="Historial"
                active={activeSection === "history"}
                onClick={() => handleNavClick("history")}
              />
              <NavItem
                icon={<Globe size={16} />}
                label="Glosario"
                active={activeSection === "dialects"}
                onClick={() => handleNavClick("dialects")}
              />
              <NavItem
                icon={<Database size={16} />}
                label="Dataset (ML)"
                active={activeSection === "archive"}
                onClick={() => handleNavClick("archive")}
              />
            </NavSection>

            <NavSection title="Configuración">
              <NavItem
                icon={<Settings size={16} />}
                label="Ajustes"
                active={activeSection === "settings"}
                onClick={() => handleNavClick("settings")}
              />
              <NavItem
                icon={<Shield size={16} />}
                label="Seguridad"
                active={activeSection === "security"}
                onClick={() => handleNavClick("security")}
              />
              <NavItem
                icon={<ScrollText size={16} />}
                label="Sistema Logs"
                active={activeSection === "logs"}
                onClick={() => handleNavClick("logs")}
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
                <div className="text-[10px] text-white/40 font-medium uppercase">Admin Root</div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </>
  );
}

function NavSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-[10px] font-bold text-white/30 uppercase tracking-widest mb-4 px-2">
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
        ${active ? 'bg-cyan-500/10 text-white' : 'text-white/60 hover:text-white hover:bg-white/5'}
      `}
      onClick={onClick}
    >
      {active && (
        <motion.div 
          layoutId="activeNav"
          className="absolute left-0 w-1 h-5 bg-cyan-500 rounded-full shadow-[0_0_10px_rgba(6,182,212,0.5)]"
        />
      )}
      
      <div className={`${active ? 'text-cyan-400' : 'text-inherit opacity-70 group-hover:opacity-100'}`}>
        {icon}
      </div>
      
      <span className={`text-sm font-medium flex-1 ${active ? 'font-bold' : ''}`}>
        {label}
      </span>

      {badge && (
        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-white/40">
          {badge}
        </span>
      )}
    </motion.div>
  );
}
