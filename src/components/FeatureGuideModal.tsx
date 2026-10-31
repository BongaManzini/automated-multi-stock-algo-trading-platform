import React, { useState } from 'react';
import { 
  HelpCircle, X, Sparkles, TrendingUp, ShieldCheck, 
  Bot, Layers, BarChart2, CheckCircle2, Eye, LayoutGrid, Monitor
} from 'lucide-react';

interface FeatureGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  viewDensity: 'clean' | 'standard' | 'pro';
  setViewDensity: (density: 'clean' | 'standard' | 'pro') => void;
  eli5Mode: boolean;
  setEli5Mode: (val: boolean) => void;
}

export const FeatureGuideModal: React.FC<FeatureGuideModalProps> = ({
  isOpen,
  onClose,
  viewDensity,
  setViewDensity,
  eli5Mode,
  setEli5Mode
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'charts' | 'wallets' | 'strategy' | 'bot'>('overview');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fadeIn">
      <div className="bg-panel-bg border border-panel-border w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Modal Header */}
        <div className="p-5 border-b border-panel-border flex items-center justify-between bg-panel-inner-bg/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-500/10 border border-indigo-500/30 rounded-xl text-indigo-400">
              <Sparkles size={22} />
            </div>
            <div>
              <h2 className="text-base font-black text-panel-heading tracking-tight flex items-center gap-2">
                Terminal Guide & Feature Explorer
                <span className="text-[10px] bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded-full font-mono uppercase font-bold">
                  Plain-English Terms
                </span>
              </h2>
              <p className="text-xs text-panel-subtext mt-0.5">
                Understand every tool in your trading cockpit in plain, simple terms.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-panel-subtext hover:text-panel-heading hover:bg-panel-inner-bg rounded-xl transition-colors"
            title="Close Guide"
          >
            <X size={20} />
          </button>
        </div>

        {/* Layout Density Quick Selector */}
        <div className="px-6 py-3 bg-indigo-950/20 border-b border-panel-border/60 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Eye size={16} className="text-indigo-400" />
            <span className="text-xs font-semibold text-panel-heading">UI Display Density:</span>
          </div>

          <div className="flex items-center gap-1.5 bg-panel-inner-bg p-1 rounded-xl border border-panel-border">
            <button
              onClick={() => setViewDensity('clean')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                viewDensity === 'clean'
                  ? 'bg-indigo-600 text-white shadow-sm font-bold'
                  : 'text-panel-subtext hover:text-panel-heading'
              }`}
            >
              <Monitor size={13} />
              Clean & Uncluttered
            </button>

            <button
              onClick={() => setViewDensity('standard')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                viewDensity === 'standard'
                  ? 'bg-indigo-600 text-white shadow-sm font-bold'
                  : 'text-panel-subtext hover:text-panel-heading'
              }`}
            >
              <LayoutGrid size={13} />
              Standard Cockpit
            </button>

            <button
              onClick={() => setViewDensity('pro')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                viewDensity === 'pro'
                  ? 'bg-indigo-600 text-white shadow-sm font-bold'
                  : 'text-panel-subtext hover:text-panel-heading'
              }`}
            >
              <Layers size={13} />
              Full Pro Suite
            </button>
          </div>
        </div>

        {/* Nav Tabs */}
        <div className="flex border-b border-panel-border/70 px-6 bg-panel-inner-bg/30 overflow-x-auto">
          {[
            { id: 'overview', label: 'Overview & Basics', icon: HelpCircle },
            { id: 'charts', label: 'Price Charts & Indicators', icon: BarChart2 },
            { id: 'wallets', label: 'Virtual Sub-Wallets', icon: ShieldCheck },
            { id: 'strategy', label: 'Strategy & Backtesting', icon: TrendingUp },
            { id: 'bot', label: 'Automated Trading Bot', icon: Bot },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`py-3 px-4 text-xs font-semibold border-b-2 flex items-center gap-2 transition-all whitespace-nowrap ${
                  isActive
                    ? 'border-indigo-500 text-indigo-400 font-bold bg-indigo-500/5'
                    : 'border-transparent text-panel-subtext hover:text-panel-heading'
                }`}
              >
                <Icon size={14} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs text-panel-subtext leading-relaxed">
          
          {activeTab === 'overview' && (
            <div className="space-y-4">
              <div className="bg-indigo-500/10 border border-indigo-500/30 p-4 rounded-xl text-panel-heading space-y-2">
                <h3 className="font-bold text-sm text-indigo-400 flex items-center gap-2">
                  <Sparkles size={16} /> What is this Trading Cockpit?
                </h3>
                <p className="text-xs text-panel-subtext leading-relaxed">
                  This platform is a 100% free, full-featured automated trading terminal. It lets you analyze live market prices, test custom trading algorithms, manage virtual sub-wallets, and execute trades automatically without risking real money until you're ready.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-panel-inner-bg p-4 rounded-xl border border-panel-border space-y-2">
                  <h4 className="font-bold text-panel-heading flex items-center gap-2 text-xs">
                    <CheckCircle2 size={15} className="text-emerald-400" /> Key Feature 1: Easy Mode (ELI5)
                  </h4>
                  <p className="text-panel-subtext text-xs">
                    Tired of complex Wall Street jargon? Toggle <strong>Simple Mode (🧸)</strong> in the left sidebar to translate complex financial formulas into simple everyday terms.
                  </p>
                </div>

                <div className="bg-panel-inner-bg p-4 rounded-xl border border-panel-border space-y-2">
                  <h4 className="font-bold text-panel-heading flex items-center gap-2 text-xs">
                    <CheckCircle2 size={15} className="text-emerald-400" /> Key Feature 2: Uncluttered Layout
                  </h4>
                  <p className="text-panel-subtext text-xs">
                    Use the <strong>Display Density Switcher</strong> above to keep your chart spacious and quiet, hiding dense indicators when you want a clean view.
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'charts' && (
            <div className="space-y-4">
              <h3 className="font-bold text-panel-heading text-sm">Understanding Price Charts & Technical Tools</h3>
              
              <div className="space-y-3">
                <div className="bg-panel-inner-bg p-3.5 rounded-xl border border-panel-border space-y-1">
                  <span className="font-bold text-indigo-400 block text-xs">🕯️ Candlesticks vs. Heikin-Ashi Mode</span>
                  <p>
                    <strong>Standard Candles</strong> show exact open, high, low, and close prices for each minute. <strong>Heikin-Ashi Mode</strong> filters out market noise by averaging price movements, making upward trends (green) and downward trends (red) super easy to spot.
                  </p>
                </div>

                <div className="bg-panel-inner-bg p-3.5 rounded-xl border border-panel-border space-y-1">
                  <span className="font-bold text-indigo-400 block text-xs">📈 RSI (Relative Strength Index)</span>
                  <p>
                    Measures whether a stock is <strong>Overbought</strong> (price rose too fast, could fall back) or <strong>Oversold</strong> (price dropped sharply, could bounce back). Reference bounds are set at 70 (overbought) and 30 (oversold).
                  </p>
                </div>

                <div className="bg-panel-inner-bg p-3.5 rounded-xl border border-panel-border space-y-1">
                  <span className="font-bold text-indigo-400 block text-xs">🎯 Infinitron Dynamic Pivots</span>
                  <p>
                    Automatically calculates price ceilings (Resistance 1 & 2) and price floors (Support 1 & 2) where prices are most likely to bounce or break out.
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'wallets' && (
            <div className="space-y-4">
              <h3 className="font-bold text-panel-heading text-sm">Virtual Sub-Wallets & Capital Protection</h3>
              <p>
                Instead of risking your entire account balance on one trade, Virtual Sub-Wallets let you ring-fence your capital into dedicated mini-budgets.
              </p>

              <div className="bg-panel-inner-bg p-4 rounded-xl border border-panel-border space-y-3">
                <div className="flex items-center justify-between border-b border-panel-border/60 pb-2">
                  <span className="font-bold text-panel-heading">Master Balance: $200.00</span>
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded font-mono font-bold">Safeguarded</span>
                </div>
                <div className="grid grid-cols-3 gap-2 font-mono text-[11px]">
                  <div className="bg-panel-bg p-2 rounded border border-panel-border text-center">
                    <span className="text-panel-subtext block text-[9px]">Gold (XAUUSD)</span>
                    <span className="font-bold text-amber-400">$120.00</span>
                  </div>
                  <div className="bg-panel-bg p-2 rounded border border-panel-border text-center">
                    <span className="text-panel-subtext block text-[9px]">NVIDIA (NVDA)</span>
                    <span className="font-bold text-emerald-400">$50.00</span>
                  </div>
                  <div className="bg-panel-bg p-2 rounded border border-panel-border text-center">
                    <span className="text-panel-subtext block text-[9px]">Apple (AAPL)</span>
                    <span className="font-bold text-indigo-400">$30.00</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'strategy' && (
            <div className="space-y-4">
              <h3 className="font-bold text-panel-heading text-sm">No-Code Strategy Builder & Backtester</h3>
              <p>
                Test your trading ideas against historical data before trading live.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="bg-panel-inner-bg p-3.5 rounded-xl border border-panel-border space-y-1">
                  <span className="font-bold text-indigo-400 block text-xs">⚙️ Strategy Builder</span>
                  <p>
                    Set rules visually like <em>"Buy when RSI is below 30 and SMA 9 crosses above SMA 21"</em> with custom Stop-Loss and Take-Profit sliders.
                  </p>
                </div>
                <div className="bg-panel-inner-bg p-3.5 rounded-xl border border-panel-border space-y-1">
                  <span className="font-bold text-indigo-400 block text-xs">📊 Backtest Reports</span>
                  <p>
                    Renders an interactive equity curve chart calculating Win Rate %, Total Profit/Loss $, Sharpe Ratio, and Maximum Risk Drawdown.
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'bot' && (
            <div className="space-y-4">
              <h3 className="font-bold text-panel-heading text-sm">Automated Watchdog & Execution Bot</h3>
              <p>
                The automated watchdog runs in the background monitoring market feeds for price signals.
              </p>

              <div className="bg-panel-inner-bg p-4 rounded-xl border border-panel-border space-y-2">
                <div className="flex items-center gap-2 text-emerald-400 font-bold">
                  <Bot size={16} /> Automated Bot Active
                </div>
                <p>
                  When your strategy rules trigger a BUY or SELL signal, the bot automatically executes orders within your sub-wallet margin boundaries and updates your position blotter live.
                </p>
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-panel-border bg-panel-inner-bg/40 flex items-center justify-between">
          <label className="flex items-center gap-2 cursor-pointer text-xs text-panel-subtext">
            <input 
              type="checkbox" 
              checked={eli5Mode}
              onChange={(e) => setEli5Mode(e.target.checked)}
              className="rounded bg-panel-inner-bg border-panel-border text-indigo-600 focus:ring-indigo-500"
            />
            <span>Enable Simple Explanations (ELI5 Mode)</span>
          </label>

          <button
            onClick={onClose}
            className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg transition-all"
          >
            Got It, Let's Trade!
          </button>
        </div>

      </div>
    </div>
  );
};
