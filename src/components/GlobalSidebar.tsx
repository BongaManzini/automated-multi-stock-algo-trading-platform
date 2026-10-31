import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  TrendingUp, 
  User, 
  Activity, 
  Play, 
  Pause, 
  ShieldAlert, 
  Sun, 
  Moon, 
  Globe, 
  HelpCircle, 
  Sliders, 
  Menu, 
  X, 
  Flame, 
  Award,
  Layers,
  HeartPulse,
  Cpu,
  BookOpen,
  ChevronRight
} from 'lucide-react';

interface GlobalSidebarProps {
  theme: 'light' | 'dark';
  setTheme: (t: 'light' | 'dark') => void;
  eli5Mode: boolean;
  setEli5Mode: (v: boolean) => void;
  selectedCurrency: 'USD' | 'EUR' | 'GBP' | 'ZAR' | 'JPY';
  setSelectedCurrency: (v: 'USD' | 'EUR' | 'GBP' | 'ZAR' | 'JPY') => void;
  isBotRunning: boolean;
  setIsBotRunning: (v: boolean) => void;
  simulationSpeed: number;
  setSimulationSpeed: (v: number) => void;
  positionsLength: number;
  onLiquidateAll: () => void;
  addLog: (category: string, level: string, msg: string) => void;
  portfolioValue: number;
  formatPrice: (v: number) => string;
  activeSidebarTab: string;
  setActiveSidebarTab: (v: string) => void;
  user?: any;
  onSignOut?: () => void;
}

export default function GlobalSidebar({
  theme,
  setTheme,
  eli5Mode,
  setEli5Mode,
  selectedCurrency,
  setSelectedCurrency,
  isBotRunning,
  setIsBotRunning,
  simulationSpeed,
  setSimulationSpeed,
  positionsLength,
  onLiquidateAll,
  addLog,
  portfolioValue,
  formatPrice,
  activeSidebarTab,
  setActiveSidebarTab,
  user,
  onSignOut
}: GlobalSidebarProps) {
  const [isOpenMobile, setIsOpenMobile] = useState(false);

  const navItems = [
    { label: '📊 Single High-Depth Cockpit', id: 'cockpit-section' },
    { label: '🔲 4-Way Multi-Chart Matrix', id: 'matrix-section' },
    { label: '🔬 Visual Strategy Builder', id: 'strategy-builder-panel' },
    { label: '📈 Quantitative Backtester', id: 'strategy-backtester-container' },
    { label: '⚡ Execution Blotter & Risk', id: 'execution-blotter-section' },
  ];

  const handleScrollToSection = (id: string) => {
    setIsOpenMobile(false);
    setActiveSidebarTab(id);
    addLog('MASTER_CHIEF', 'INFO', `Switched workspace tab to: ${id}`);
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const sidebarContent = (
    <div className="flex flex-col h-full bg-panel-bg border-r border-panel-border transition-all duration-200">
      {/* 1. Header with Logo and DEMO Badge */}
      <div className="p-5 border-b border-panel-border/70">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-indigo-600/15 p-1.5 rounded-lg text-indigo-500 border border-indigo-500/25">
              <TrendingUp size={20} className="animate-pulse" />
            </div>
            <div>
              <h1 className="text-sm font-extrabold tracking-tight text-panel-heading uppercase font-mono">
                QUANTUM-ALGO
              </h1>
              <p className="text-[9px] text-panel-subtext font-semibold font-mono tracking-wider">
                VIRTUAL SANDBOX v2.0
              </p>
            </div>
          </div>
          <span className="bg-amber-500/10 text-amber-600 dark:text-amber-450 border border-amber-500/30 text-[9px] px-2 py-0.5 rounded-full font-mono font-black animate-pulse">
            DEMO
          </span>
        </div>
      </div>

      {/* 2. User Profile Widget */}
      <div className="p-4 border-b border-panel-border/70 bg-panel-inner-bg/40">
        <div className="flex items-center gap-3">
          <div className="relative group">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center font-bold text-sm shadow-md transition duration-200">
              {user?.displayName 
                ? user.displayName.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase()
                : user?.email ? user.email.substring(0, 2).toUpperCase() : 'TR'}
            </div>
            <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 border-2 border-panel-bg flex items-center justify-center text-[7px] text-white font-bold" title="Live connection active">
              ✓
            </div>
          </div>
          <div className="text-left overflow-hidden animate-fadeIn">
            <h3 className="text-xs font-bold text-panel-heading truncate">
              {user?.displayName || 'Active Trader'}
            </h3>
            <p className="text-[10px] text-panel-subtext truncate">
              {user?.email || 'simulation-sandbox'}
            </p>
            <div className="mt-1 flex items-center gap-2">
              <span className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[8px] font-bold px-1.5 py-0.5 rounded border border-emerald-500/20 font-mono">
                SECURE ACCOUNT
              </span>
              {onSignOut && (
                <button
                  id="sidebar-signout-btn"
                  type="button"
                  onClick={onSignOut}
                  className="text-[9px] font-bold text-rose-500 hover:text-rose-400 hover:underline transition cursor-pointer"
                >
                  Sign Out
                </button>
              )}
            </div>
          </div>
        </div>
        <div className="mt-3 p-2 bg-panel-bg border border-panel-border/80 rounded-lg">
          <div className="flex justify-between items-center">
            <span className="text-[9px] text-panel-subtext font-mono uppercase">Sim Net Asset</span>
            <span className="text-xs font-bold font-mono text-indigo-500">{formatPrice(portfolioValue)}</span>
          </div>
        </div>
      </div>

      {/* 3. Demo Status indicator */}
      <div className="p-3 border-b border-panel-border/70">
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-2.5 text-[10px] text-amber-800 dark:text-amber-450 space-y-1">
          <div className="flex items-center gap-1.5 font-bold font-mono text-amber-900 dark:text-amber-300">
            <ShieldAlert size={12} className="shrink-0" />
            <span>SANDBOX ACCOUNT</span>
          </div>
          <p className="leading-relaxed opacity-90 text-[9px]">
            Market ticks are virtual high-frequency feeds. Real-time paper trading simulator is active. No real funds used.
          </p>
        </div>
      </div>

      {/* 4. Scroll Navigation */}
      <div className="p-4 border-b border-panel-border/70 space-y-1.5">
        <span className="text-[9px] text-panel-subtext uppercase font-mono tracking-widest font-bold block px-2 mb-1">
          Section Navigation
        </span>
        {navItems.map((item) => {
          const isActive = activeSidebarTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => handleScrollToSection(item.id)}
              className={`w-full text-left px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-between group cursor-pointer border ${
                isActive
                  ? 'bg-indigo-600 dark:bg-indigo-650 text-white border-indigo-500/20 shadow-sm'
                  : 'text-panel-subtext hover:text-panel-heading hover:bg-panel-inner-bg border-transparent hover:border-panel-border'
              }`}
            >
              <span>{item.label}</span>
              <ChevronRight size={12} className={`transition-transform group-hover:translate-x-0.5 ${isActive ? 'text-white' : 'text-panel-subtext/40 group-hover:text-panel-heading'}`} />
            </button>
          );
        })}
      </div>

      {/* 5. Core Engine Control Deck */}
      <div className="p-4 border-b border-panel-border/70 space-y-3">
        <span className="text-[9px] text-panel-subtext uppercase font-mono tracking-widest font-bold block px-2">
          Engine Control Deck
        </span>
        
        {/* Play/Pause automation */}
        <button
          onClick={() => {
            setIsBotRunning(!isBotRunning);
            addLog('DATA_INDICATOR', 'INFO', `Automation orchestrator ${!isBotRunning ? 'STARTED' : 'PAUSED'} from global side panel.`);
          }}
          className={`w-full py-2 px-3 rounded-lg text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm ${
            isBotRunning 
              ? 'bg-rose-600 hover:bg-rose-700 text-white shadow shadow-rose-950/20' 
              : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow shadow-emerald-950/20'
          }`}
        >
          {isBotRunning ? (
            <>
              <Pause size={13} fill="currentColor" /> Pause Automation
            </>
          ) : (
            <>
              <Play size={13} fill="currentColor" /> Start Automation
            </>
          )}
        </button>

        {/* Panic liquidation */}
        <button
          onClick={onLiquidateAll}
          disabled={positionsLength === 0}
          className={`w-full py-2 px-3 rounded-lg text-xs font-bold uppercase tracking-wider border transition-all flex items-center justify-center gap-1.5 ${
            positionsLength > 0 
              ? 'bg-red-500/10 text-red-500 dark:text-red-400 hover:bg-red-500/20 border-red-500/30 cursor-pointer shadow-sm' 
              : 'bg-panel-inner-bg text-panel-subtext opacity-50 border-panel-border cursor-not-allowed'
          }`}
        >
          <Flame size={13} /> Panic: Liquidate All ({positionsLength})
        </button>

        {/* Tick Interval Selector */}
        <div className="space-y-1">
          <label className="text-[10px] text-panel-subtext font-mono pl-1">Simulation Speed</label>
          <div className="bg-panel-inner-bg border border-panel-border rounded-lg px-2.5 py-1 text-xs">
            <select 
              value={simulationSpeed} 
              onChange={(e) => setSimulationSpeed(parseFloat(e.target.value))}
              className="bg-transparent font-mono font-bold focus:outline-none cursor-pointer text-panel-heading w-full"
            >
              <option value={0.5} className="bg-panel-bg text-panel-heading">0.5s (High Freq)</option>
              <option value={1.0} className="bg-panel-bg text-panel-heading">1.0s (Fast)</option>
              <option value={1.5} className="bg-panel-bg text-panel-heading">1.5s (Normal)</option>
              <option value={3.0} className="bg-panel-bg text-panel-heading">3.0s (Relaxed)</option>
            </select>
          </div>
        </div>
      </div>

      {/* 6. Settings & Preferences Grid */}
      <div className="p-4 space-y-3 mt-auto">
        <span className="text-[9px] text-panel-subtext uppercase font-mono tracking-widest font-bold block px-2">
          Global Preferences
        </span>

        {/* Region / Currency */}
        <div className="flex items-center justify-between bg-panel-inner-bg border border-panel-border rounded-lg p-2 text-xs">
          <span className="text-[10px] text-panel-subtext font-mono flex items-center gap-1">
            <Globe size={11} /> Currency
          </span>
          <select 
            value={selectedCurrency} 
            onChange={(e) => {
              const val = e.target.value as any;
              setSelectedCurrency(val);
              addLog('MASTER_CHIEF', 'INFO', `Global currency region switched to: ${val}.`);
            }}
            className="bg-transparent font-bold focus:outline-none cursor-pointer text-panel-heading text-xs"
          >
            <option value="USD" className="bg-panel-bg text-panel-heading">US ($)</option>
            <option value="EUR" className="bg-panel-bg text-panel-heading">EU (€)</option>
            <option value="GBP" className="bg-panel-bg text-panel-heading">UK (£)</option>
            <option value="ZAR" className="bg-panel-bg text-panel-heading">ZA (R)</option>
            <option value="JPY" className="bg-panel-bg text-panel-heading">JP (¥)</option>
          </select>
        </div>

        {/* ELI5 and Theme Toggles */}
        <div className="grid grid-cols-2 gap-2">
          {/* ELI5 */}
          <button
            onClick={() => {
              setEli5Mode(!eli5Mode);
              addLog('MASTER_CHIEF', 'SUCCESS', `🧸 ELI5 mode is now ${!eli5Mode ? 'ACTIVE' : 'DEACTIVATED'}.`);
            }}
            className={`flex items-center justify-center gap-1.5 py-1.5 text-xs font-bold rounded-lg transition cursor-pointer border ${
              eli5Mode 
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-450 shadow-sm' 
                : 'bg-panel-inner-bg border-panel-border text-panel-subtext hover:text-panel-heading'
            }`}
            title="Explain Like I'm 5 Mode"
          >
            <span>🧸 ELI5</span>
            <span className={`w-1.5 h-1.5 rounded-full ${eli5Mode ? 'bg-amber-500' : 'bg-transparent'}`} />
          </button>

          {/* Theme Toggle */}
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="flex items-center justify-center gap-1.5 py-1.5 text-xs font-bold rounded-lg bg-panel-inner-bg hover:bg-panel-border border border-panel-border transition cursor-pointer text-panel-subtext hover:text-panel-heading"
            title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
          >
            {theme === 'dark' ? (
              <>
                <Sun size={12} className="text-amber-500" />
                <span>Light</span>
              </>
            ) : (
              <>
                <Moon size={12} className="text-indigo-600" />
                <span>Dark</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* A. DESKTOP PERMANENT SIDEBAR */}
      <aside id="sidebar-navigator" className="hidden lg:block w-64 xl:w-72 h-screen sticky top-0 shrink-0 overflow-y-auto select-none z-30">
        {sidebarContent}
      </aside>

      {/* B. MOBILE HEADER BAR */}
      <div className="lg:hidden w-full bg-panel-bg border-b border-panel-border px-4 py-3.5 flex items-center justify-between sticky top-0 z-40 select-none">
        <div className="flex items-center gap-2">
          <div className="bg-indigo-600/15 p-1 rounded-md text-indigo-500">
            <TrendingUp size={16} />
          </div>
          <div>
            <span className="text-xs font-extrabold tracking-tight text-panel-heading font-mono uppercase">
              QUANTUM-ALGO
            </span>
            <div className="flex items-center gap-1">
              <span className="bg-amber-500/10 text-amber-500 text-[8px] font-bold font-mono px-1 rounded">
                DEMO
              </span>
              <span className="text-[8px] text-panel-subtext font-mono">
                Bonga Manzini
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Active indicator */}
          <span className="flex h-2 w-2 relative">
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isBotRunning ? 'bg-emerald-400' : 'bg-rose-400'}`} />
            <span className={`relative inline-flex rounded-full h-2 w-2 ${isBotRunning ? 'bg-emerald-500' : 'bg-rose-500'}`} />
          </span>

          <button
            onClick={() => setIsOpenMobile(true)}
            className="p-1.5 rounded-lg bg-panel-inner-bg border border-panel-border text-panel-heading hover:bg-panel-border transition cursor-pointer"
          >
            <Menu size={16} />
          </button>
        </div>
      </div>

      {/* C. MOBILE DRAWER OVERLAY */}
      <AnimatePresence>
        {isOpenMobile && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpenMobile(false)}
              className="lg:hidden fixed inset-0 bg-black z-45"
            />

            {/* Sidebar Slider Drawer */}
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="lg:hidden fixed inset-y-0 left-0 w-80 max-w-[85vw] h-full z-50 overflow-y-auto"
            >
              <div className="h-full relative">
                {/* Close Button Inside Drawer */}
                <button
                  onClick={() => setIsOpenMobile(false)}
                  className="absolute top-4 right-4 p-1 rounded-lg bg-panel-inner-bg border border-panel-border text-panel-subtext hover:text-panel-heading cursor-pointer z-50"
                >
                  <X size={15} />
                </button>
                {sidebarContent}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
