/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Settings, 
  ShieldAlert, 
  Layers, 
  Cpu, 
  Bell, 
  ArrowUpRight, 
  ArrowDownRight,
  Briefcase,
  Activity, 
  History, 
  Database, 
  ShieldCheck, 
  Terminal, 
  Link, 
  Settings2, 
  Code, 
  Copy, 
  Check,
  AlertTriangle,
  Radio,
  Key,
  HeartPulse,
  Award,
  Info
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell, 
  Tooltip as RechartsTooltip, 
  Legend as RechartsLegend 
} from 'recharts';
import { BrokerConfig, Position, Order, AgentLog, Portfolio } from '../types';
import { PriceAlert } from '../App';

// Define the Ticker metadata locally
export const TICKER_INFO: Record<string, { name: string; initPrice: number; volatilityMultiplier: number }> = {
  AAPL: { name: 'Apple Inc.', initPrice: 175.50, volatilityMultiplier: 0.35 },
  TSLA: { name: 'Tesla Motors', initPrice: 210.20, volatilityMultiplier: 0.85 },
  MSFT: { name: 'Microsoft Corp.', initPrice: 415.10, volatilityMultiplier: 0.25 },
  NVDA: { name: 'NVIDIA Corp.', initPrice: 875.00, volatilityMultiplier: 1.20 },
  COIN: { name: 'Coinbase Global', initPrice: 242.40, volatilityMultiplier: 1.50 },
};

const POPULAR_NAMES: Record<string, string> = {
  AAPL: 'Apple Inc.',
  TSLA: 'Tesla Motors',
  MSFT: 'Microsoft Corp.',
  NVDA: 'NVIDIA Corp.',
  COIN: 'Coinbase Global',
  BTC_USD: 'Bitcoin / USD',
  GOOG: 'Alphabet Inc. (Class C)',
  GOOGL: 'Alphabet Inc. (Class A)',
  AMZN: 'Amazon.com, Inc.',
  META: 'Meta Platforms, Inc.',
  NFLX: 'Netflix, Inc.',
};

interface SidebarNavigatorProps {
  tickers: string[];
  onAddTicker: (ticker: string) => void;
  brokerConfig: BrokerConfig;
  setBrokerConfig: (cfg: BrokerConfig) => void;
  selectedTicker: string;
  setSelectedTicker: (ticker: string) => void;
  automatedTickers: Record<string, boolean>;
  setAutomatedTickers: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  currentPrices: Record<string, number>;
  positions: Position[];
  alerts: PriceAlert[];
  setAlerts: React.Dispatch<React.SetStateAction<PriceAlert[]>>;
  alertThreshold: number;
  setAlertThreshold: (val: number) => void;
  alertWindow: number;
  addLog: (agent: any, level: any, msg: string) => void;
  executeOrder: (ticker: string, side: 'BUY' | 'SELL', price: number, qty: number, comment: string) => void;
  orders: Order[];
  agentLogs: AgentLog[];
  setAgentLogs: React.Dispatch<React.SetStateAction<AgentLog[]>>;
  portfolio: Portfolio;
  handleManualTrade: (side: 'BUY' | 'SELL') => void;
  onOpenSummaryModal?: () => void;
  onQuickTrade?: (ticker: string) => void;
  marketData: Record<string, any[]>;
  formatPrice: (val: number) => string;
  eli5Mode: boolean;
  smartStrategyRules: Record<string, {
    ticker: string;
    isEnabled: boolean;
    withdrawThresholdPercent: number;
    withdrawPercentage: number;
    scaleUpThresholdPercent: number;
    scaleUpIncrementPercent: number;
    stats: {
      originalInvestment: number;
      currentInvestmentValue: number;
      withdrawnCapitalCash: number;
      totalEarnedOrLost: number;
      status: 'idle' | 'withdrawn' | 'boosted' | 'bust';
    }
  }>;
  setSmartStrategyRules: React.Dispatch<React.SetStateAction<Record<string, any>>>;
  realizedPnLByTicker: Record<string, number>;
  activeTab?: 'market' | 'terminal' | 'agents' | 'broker' | 'health';
  setActiveTab?: (tab: 'market' | 'terminal' | 'agents' | 'broker' | 'health') => void;
}

export default function SidebarNavigator({
  tickers,
  onAddTicker,
  brokerConfig,
  setBrokerConfig,
  selectedTicker,
  setSelectedTicker,
  automatedTickers,
  setAutomatedTickers,
  currentPrices,
  positions,
  alerts,
  setAlerts,
  alertThreshold,
  setAlertThreshold,
  alertWindow,
  addLog,
  executeOrder,
  orders,
  agentLogs,
  setAgentLogs,
  portfolio,
  handleManualTrade,
  onOpenSummaryModal,
  onQuickTrade,
  marketData,
  formatPrice,
  eli5Mode,
  smartStrategyRules,
  setSmartStrategyRules,
  realizedPnLByTicker,
  activeTab: propActiveTab,
  setActiveTab: propSetActiveTab,
}: SidebarNavigatorProps) {
  // Local active tab states
  const [localActiveTab, setLocalActiveTab] = useState<'market' | 'terminal' | 'agents' | 'broker' | 'health'>('market');
  const activeTab = propActiveTab !== undefined ? propActiveTab : localActiveTab;
  const setActiveTab = propSetActiveTab !== undefined ? propSetActiveTab : setLocalActiveTab;
  const [hoveredTile, setHoveredTile] = useState<any | null>(null);
  const [agentLogSubTab, setAgentLogSubTab] = useState<'ALL' | 'DATA' | 'RISK' | 'EXEC'>('ALL');
  const [selectedLang, setSelectedLang] = useState<'ts' | 'py'>('ts');
  const [copied, setCopied] = useState(false);
  const [newTickerInput, setNewTickerInput] = useState('');

  const handleAddTickerSubmit = () => {
    const symbol = newTickerInput.trim().toUpperCase();
    if (symbol) {
      onAddTicker(symbol);
      setNewTickerInput('');
    }
  };

  // Filter agent logs based on local sub-tab selection
  const filteredLogs = agentLogs.filter((log) => {
    if (agentLogSubTab === 'DATA') return log.agent === 'DATA_INDICATOR';
    if (agentLogSubTab === 'RISK') return log.agent === 'RISK_PORTFOLIO';
    if (agentLogSubTab === 'EXEC') return log.agent === 'EXECUTION_BROKER';
    return true;
  });

  // Code snippets
  const pythonCode = `import os
from alpaca.trading.client import TradingClient
from alpaca.trading.requests import MarketOrderRequest
from alpaca.trading.enums import OrderSide, TimeInForce

API_KEY = os.getenv("ALPACA_API_KEY", "${brokerConfig.apiKey || 'MOCK_KEY_ID'}")
API_SECRET = os.getenv("ALPACA_SECRET_KEY", "MOCK_SECRET")
IS_LIVE = ${brokerConfig.isLive ? 'True' : 'False'}

def execute_order(ticker: str, quantity: int, side: str):
    """
    [Execution & Broker Agent] 
    Routes trade order securely depending on is_live status.
    """
    print(f"[Execution Engine] Order: {side} {quantity} shares of {ticker}")
    if not IS_LIVE:
        base_url = "https://paper-api.alpaca.markets"
        print("⚠️ [Execution Alert] Sandbox Routing.")
    else:
        base_url = "https://api.alpaca.markets"
        print("🔴 [WARNING] Routing directly to LIVE Exchanges.")

    client = TradingClient(api_key=API_KEY, secret_key=API_SECRET, paper=not IS_LIVE, url_override=base_url)
    order_data = MarketOrderRequest(
        symbol=ticker,
        qty=quantity,
        side=OrderSide.BUY if side.upper() == "BUY" else OrderSide.SELL,
        time_in_force=TimeInForce.GTC
    )
    return client.submit_order(order_data)
`;

  const tsCode = `import axios from 'axios';

const API_KEY = '${brokerConfig.apiKey || 'MOCK_KEY_ID'}';
const API_SECRET = 'MOCK_SECRET';
const IS_LIVE = ${brokerConfig.isLive ? 'true' : 'false'};

export async function executeBrokerOrder(order: { ticker: string, quantity: number, side: 'BUY' | 'SELL' }) {
  const baseUrl = IS_LIVE 
    ? 'https://api.alpaca.markets/v2' 
    : 'https://paper-api.alpaca.markets/v2';

  const orderPayload = {
    symbol: order.ticker,
    qty: order.quantity.toString(),
    side: order.side.toLowerCase(),
    type: 'market',
    time_in_force: 'gtc'
  };

  const response = await axios.post(\`\${baseUrl}/orders\`, orderPayload, {
    headers: {
      'APCA-API-KEY-ID': API_KEY,
      'APCA-API-SECRET-KEY': API_SECRET,
    }
  });
  return response.data;
}
`;

  const handleCopy = () => {
    const code = selectedLang === 'ts' ? tsCode : pythonCode;
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <aside id="sidebar-navigator" className="w-full lg:w-[350px] shrink-0 space-y-4">
      
      {/* 5-Column Navigation Bar */}
      <div className="flex bg-panel-inner-bg p-1 rounded-xl border border-panel-border grid grid-cols-5 select-none">
        <button
          onClick={() => setActiveTab('market')}
          className={`py-2 rounded-lg text-[10px] font-bold transition flex flex-col items-center justify-center gap-1 cursor-pointer ${
            activeTab === 'market'
              ? 'bg-indigo-600 text-white shadow'
              : 'text-panel-subtext hover:text-panel-heading hover:bg-panel-bg'
          }`}
          title="Market Watch & Alerts"
        >
          <Layers size={14} />
          <span>Market</span>
        </button>
        <button
          onClick={() => setActiveTab('terminal')}
          className={`py-2 rounded-lg text-[10px] font-bold transition flex flex-col items-center justify-center gap-1 cursor-pointer ${
            activeTab === 'terminal'
              ? 'bg-indigo-600 text-white shadow'
              : 'text-panel-subtext hover:text-panel-heading hover:bg-panel-bg'
          }`}
          title="Positions & Manual execution panel override"
        >
          <Activity size={14} />
          <span>Terminal</span>
        </button>
        <button
          onClick={() => setActiveTab('health')}
          className={`py-2 rounded-lg text-[10px] font-bold transition flex flex-col items-center justify-center gap-1 cursor-pointer ${
            activeTab === 'health'
              ? 'bg-indigo-600 text-white shadow'
              : 'text-panel-subtext hover:text-panel-heading hover:bg-panel-bg'
          }`}
          title="Portfolio Health, Margin, & Sector Exposure"
        >
          <HeartPulse size={14} />
          <span>Health</span>
        </button>
        <button
          onClick={() => setActiveTab('agents')}
          className={`py-2 rounded-lg text-[10px] font-bold transition flex flex-col items-center justify-center gap-1 cursor-pointer ${
            activeTab === 'agents'
              ? 'bg-indigo-600 text-white shadow'
              : 'text-panel-subtext hover:text-panel-heading hover:bg-panel-bg'
          }`}
          title="Multi-agent Orchestrator Stream & Status"
        >
          <Cpu size={14} />
          <span>Agents</span>
        </button>
        <button
          onClick={() => setActiveTab('broker')}
          className={`py-2 rounded-lg text-[10px] font-bold transition flex flex-col items-center justify-center gap-1 cursor-pointer ${
            activeTab === 'broker'
              ? 'bg-indigo-600 text-white shadow'
              : 'text-panel-subtext hover:text-panel-heading hover:bg-panel-bg'
          }`}
          title="Secure Broker Integration & API Codes"
        >
          <Settings size={14} />
          <span>Broker</span>
        </button>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'market' && (
          <motion.div
            key="market-panel"
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ duration: 0.15 }}
            className="space-y-4"
          >
            {/* Market Watch Instrument Indexing */}
            <div className="bg-panel-bg border border-panel-border rounded-xl p-4 shadow-sm space-y-4 transition-colors">
              <div className="flex items-center justify-between border-b border-panel-border pb-2.5">
                <h3 className="text-xs font-bold text-panel-heading tracking-tight flex items-center gap-1.5">
                  <Layers size={14} className="text-indigo-500" />
                  Market Watch Index
                </h3>
                <span className="text-[9.5px] bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-400 px-2 py-0.5 border border-emerald-200 dark:border-emerald-900 rounded-full font-mono font-bold leading-none">
                  {Object.values(automatedTickers).filter(Boolean).length} / {tickers.length} AUTO
                </span>
              </div>

              {/* Add Custom Ticker Input Box */}
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Type ticker (e.g., GOOG, AMZN, NFLX)..."
                  value={newTickerInput}
                  onChange={(e) => setNewTickerInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleAddTickerSubmit();
                    }
                  }}
                  className="flex-1 bg-panel-inner-bg border border-panel-border text-panel-heading placeholder-panel-subtext text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-indigo-500 font-mono animate-none"
                />
                <button
                  type="button"
                  onClick={handleAddTickerSubmit}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition shrink-0 cursor-pointer flex items-center justify-center font-sans"
                >
                  Add
                </button>
              </div>

              {/* Watchlist tickers mapped */}
              <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
                {tickers.map((ticker) => {
                  const info = TICKER_INFO[ticker];
                  const isSelected = selectedTicker === ticker;
                  const isAutomated = automatedTickers[ticker];
                  const price = currentPrices[ticker] || info?.initPrice || 100;
                  const activePos = positions.find(p => p.ticker === ticker);
                  const name = info?.name || POPULAR_NAMES[ticker] || `${ticker} Common Stock`;
                  
                  const candles = marketData[ticker] || [];
                  const lastCandle = candles[candles.length - 1];

                  return (
                    <div
                      key={ticker}
                      className={`p-2 rounded-xl border transition flex flex-col gap-1.5 relative overflow-hidden ${
                        isSelected
                          ? 'bg-indigo-650/10 border-indigo-500'
                          : 'bg-panel-inner-bg border-panel-border hover:border-panel-subtext/45'
                      }`}
                    >
                      {isAutomated && (
                        <span className="absolute top-1.5 right-1.5 flex h-1.5 w-1.5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                        </span>
                      )}

                      <div className="flex items-center justify-between">
                        {/* Selector info click area */}
                        <div className="cursor-pointer flex-1 min-w-0" onClick={() => setSelectedTicker(ticker)}>
                          <div className="flex items-center gap-1.5">
                            <span className={`text-xs font-black transition-colors ${isSelected ? 'text-indigo-600 dark:text-indigo-400' : 'text-panel-heading'}`}>
                              {ticker}
                            </span>
                            {activePos && (
                              <span className="text-[8px] bg-indigo-600 text-white px-1 py-0.2 rounded font-mono font-bold leading-none">
                                POS
                              </span>
                            )}
                          </div>
                          <p className="text-[9.5px] text-panel-subtext truncate max-w-[140px] mt-0.5 leading-none">
                            {name}
                          </p>
                        </div>

                        <div className="text-right flex items-center gap-2">
                          <span className="text-[11.5px] font-mono text-panel-heading font-bold">{formatPrice(price)}</span>
                          
                          {/* Toggle switch */}
                          <button
                            onClick={() => {
                              setAutomatedTickers(prev => {
                                const next = { ...prev, [ticker]: !prev[ticker] };
                                addLog(
                                  'DATA_INDICATOR',
                                  'INFO',
                                  `${ticker} Auto-pilot trading ${next[ticker] ? 'ENABLED 🤖' : 'DISABLED 👤 (Manual only)'}.`
                                );
                                return next;
                              });
                            }}
                            className={`p-1 rounded-md transition cursor-pointer text-[10px] ${
                              isAutomated
                                ? 'bg-emerald-105 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900'
                                : 'bg-panel-bg text-panel-subtext border border-panel-border hover:text-panel-heading hover:border-panel-subtext/45'
                            }`}
                            title={`Toggle Auto-Pilot for ${ticker}`}
                          >
                            {isAutomated ? <Cpu size={12} className="animate-pulse" /> : <Settings size={12} />}
                          </button>
                        </div>
                      </div>

                      {/* Expandable smart details if selected */}
                      {isSelected && (
                        <div className="mt-2 pt-2 border-t border-panel-border space-y-2.5 text-[10.5px]">
                          {/* Active Indicators list */}
                          {lastCandle && (
                            <div className="space-y-1">
                              <p className="font-bold text-panel-heading flex items-center gap-1 text-[10px]">
                                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" /> Active Indicators:
                              </p>
                              <div className="grid grid-cols-2 gap-1.5 font-mono text-[9.5px] bg-panel-bg p-1.5 rounded border border-panel-border">
                                <div>SMA (Short): <span className="text-panel-heading font-bold">{lastCandle.smaShort ? formatPrice(lastCandle.smaShort) : 'N/A'}</span></div>
                                <div>SMA (Long): <span className="text-panel-heading font-bold">{lastCandle.smaLong ? formatPrice(lastCandle.smaLong) : 'N/A'}</span></div>
                                <div className="col-span-2 flex justify-between border-t border-panel-border/30 pt-1 mt-1">
                                  <span>RSI (14): <span className={`font-bold ${lastCandle.rsi > 70 ? 'text-rose-500' : lastCandle.rsi < 30 ? 'text-emerald-500' : 'text-amber-500'}`}>{lastCandle.rsi ? lastCandle.rsi.toFixed(1) : 'N/A'}</span></span>
                                  <span>MACD: <span className="text-panel-heading font-bold">{lastCandle.macdVal ? lastCandle.macdVal.toFixed(2) : 'N/A'}</span></span>
                                </div>
                              </div>
                              {eli5Mode && (
                                <p className="text-[9px] text-amber-600 dark:text-amber-450 leading-tight">
                                  🧸 <em>ELI5: Active indicators are detective tools 🔍 looking at the chart to see if people want to buy or sell!</em>
                                </p>
                              )}
                            </div>
                          )}

                          {/* Performance Tracker */}
                          <div className="space-y-1">
                            <p className="font-bold text-panel-heading flex items-center gap-1 text-[10px]">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Performance Stats:
                            </p>
                            <div className="grid grid-cols-2 gap-1.5 font-mono text-[9.5px] bg-panel-bg p-1.5 rounded border border-panel-border">
                              <div>Realized P&L: <span className={`font-bold ${ (realizedPnLByTicker[ticker] || 0) >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>{formatPrice(realizedPnLByTicker[ticker] || 0)}</span></div>
                              <div>Withdrawn Cash: <span className="text-emerald-500 font-bold">{formatPrice(smartStrategyRules[ticker]?.stats?.withdrawnCapitalCash || 0)}</span></div>
                            </div>
                            {eli5Mode && (
                              <p className="text-[9px] text-amber-600 dark:text-amber-450 leading-tight">
                                🧸 <em>ELI5: Realized P&L is how many cookies you won or lost in past trades of this stock! Withdrawn Cash is cookie coins kept safe in your bank!</em>
                              </p>
                            )}
                          </div>

                          {/* Smart Risk Allocation Tools */}
                          <div className="space-y-1.5 pt-1.5 border-t border-panel-border/40">
                            <div className="flex items-center justify-between">
                              <p className="font-bold text-panel-heading text-[10px] flex items-center gap-1">
                                ⚙️ Smart Risk Guard tools:
                              </p>
                              <label className="relative inline-flex items-center cursor-pointer scale-75 select-none">
                                <input 
                                  type="checkbox" 
                                  checked={smartStrategyRules[ticker]?.isEnabled || false} 
                                  onChange={(e) => {
                                    const isChecked = e.target.checked;
                                    setSmartStrategyRules(prev => ({
                                      ...prev,
                                      [ticker]: {
                                        ...prev[ticker],
                                        isEnabled: isChecked
                                      }
                                    }));
                                    addLog('MASTER_CHIEF', 'INFO', `Smart Risk Guard tools ${isChecked ? 'ENABLED 🤖' : 'DISABLED 👤'} for ${ticker}.`);
                                  }}
                                  className="sr-only peer"
                                />
                                <div className="w-7 h-4 bg-panel-border peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-indigo-600"></div>
                              </label>
                            </div>

                            {smartStrategyRules[ticker]?.isEnabled && (
                              <div className="space-y-2 bg-panel-bg p-2 rounded border border-panel-border">
                                {/* Option A: Drop partial stop-out (Candy Saver) */}
                                <div className="space-y-1">
                                  <div className="flex justify-between text-[9px] font-mono leading-tight">
                                    <span className="font-bold text-panel-heading">🍬 Preservation Threshold:</span>
                                    <span className="text-indigo-500 font-bold">-{smartStrategyRules[ticker].withdrawThresholdPercent}% / Sell {smartStrategyRules[ticker].withdrawPercentage}%</span>
                                  </div>
                                  <div className="flex gap-1.5">
                                    <input 
                                      type="range"
                                      min="1"
                                      max="10"
                                      step="0.5"
                                      value={smartStrategyRules[ticker].withdrawThresholdPercent}
                                      onChange={(e) => {
                                        const val = parseFloat(e.target.value);
                                        setSmartStrategyRules(prev => ({
                                          ...prev,
                                          [ticker]: {
                                            ...prev[ticker],
                                            withdrawThresholdPercent: val
                                          }
                                        }));
                                      }}
                                      className="w-1/2 accent-indigo-500 bg-panel-inner-bg h-1 rounded cursor-pointer"
                                      title="Drop percent trigger"
                                    />
                                    <input 
                                      type="range"
                                      min="10"
                                      max="100"
                                      step="5"
                                      value={smartStrategyRules[ticker].withdrawPercentage}
                                      onChange={(e) => {
                                        const val = parseFloat(e.target.value);
                                        setSmartStrategyRules(prev => ({
                                          ...prev,
                                          [ticker]: {
                                            ...prev[ticker],
                                            withdrawPercentage: val
                                          }
                                        }));
                                      }}
                                      className="w-1/2 accent-indigo-500 bg-panel-inner-bg h-1 rounded cursor-pointer"
                                      title="Withdraw percent to pocket"
                                    />
                                  </div>
                                  {eli5Mode && (
                                    <p className="text-[8.5px] text-amber-600 dark:text-amber-450 leading-none">
                                      🧸 <em>ELI5: If stock drops {smartStrategyRules[ticker].withdrawThresholdPercent}%, sell {smartStrategyRules[ticker].withdrawPercentage}% shares to save my candies! 🍬</em>
                                    </p>
                                  )}
                                </div>

                                {/* Option B: Scaling in booster (Trend Booster) */}
                                <div className="space-y-1 border-t border-panel-border/30 pt-1.5">
                                  <div className="flex justify-between text-[9px] font-mono leading-tight">
                                    <span className="font-bold text-panel-heading">🚀 Boost Threshold:</span>
                                    <span className="text-indigo-500 font-bold">+{smartStrategyRules[ticker].scaleUpThresholdPercent}% / Add {smartStrategyRules[ticker].scaleUpIncrementPercent}%</span>
                                  </div>
                                  <div className="flex gap-1.5">
                                    <input 
                                      type="range"
                                      min="1"
                                      max="15"
                                      step="0.5"
                                      value={smartStrategyRules[ticker].scaleUpThresholdPercent}
                                      onChange={(e) => {
                                        const val = parseFloat(e.target.value);
                                        setSmartStrategyRules(prev => ({
                                          ...prev,
                                          [ticker]: {
                                            ...prev[ticker],
                                            scaleUpThresholdPercent: val
                                          }
                                        }));
                                      }}
                                      className="w-1/2 accent-indigo-500 bg-panel-inner-bg h-1 rounded cursor-pointer"
                                      title="Gain percent trigger"
                                    />
                                    <input 
                                      type="range"
                                      min="5"
                                      max="50"
                                      step="5"
                                      value={smartStrategyRules[ticker].scaleUpIncrementPercent}
                                      onChange={(e) => {
                                        const val = parseFloat(e.target.value);
                                        setSmartStrategyRules(prev => ({
                                          ...prev,
                                          [ticker]: {
                                            ...prev[ticker],
                                            scaleUpIncrementPercent: val
                                          }
                                        }));
                                      }}
                                      className="w-1/2 accent-indigo-500 bg-panel-inner-bg h-1 rounded cursor-pointer"
                                      title="Increase percent allocation"
                                    />
                                  </div>
                                  {eli5Mode && (
                                    <p className="text-[8.5px] text-amber-600 dark:text-amber-450 leading-none">
                                      🧸 <em>ELI5: If stock goes up {smartStrategyRules[ticker].scaleUpThresholdPercent}%, buy {smartStrategyRules[ticker].scaleUpIncrementPercent}% more shares to win more cookies! 🚀</em>
                                    </p>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Growth & Loss Real-time Alerts */}
            <div className="bg-panel-bg border border-panel-border rounded-xl p-4 shadow-sm space-y-4 transition-colors">
              <div className="flex items-center justify-between border-b border-panel-border pb-2.5">
                <div className="flex items-center gap-1.5">
                  <div className="relative">
                    <Bell className="w-3.5 h-3.5 text-amber-500 animate-bounce" />
                    {alerts.some(a => !a.acknowledged) && (
                      <span className="absolute -top-1 -right-1 w-1.5 h-1.5 bg-rose-500 rounded-full animate-ping" />
                    )}
                  </div>
                  <h3 className="text-xs font-bold text-panel-heading tracking-tight">
                    Volatility Feed Alerts
                  </h3>
                </div>
                <button 
                  onClick={() => setAlerts([])}
                  disabled={alerts.length === 0}
                  className="text-panel-subtext hover:text-panel-heading disabled:opacity-50 cursor-pointer font-mono text-[9px] hover:underline"
                >
                  Clear
                </button>
              </div>

              {/* Alerts threshold input */}
              <div className="p-3 bg-panel-inner-bg rounded-xl border border-panel-border space-y-1.5">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-panel-subtext font-mono flex items-center gap-1">
                    <Settings size={11} className="text-indigo-500" /> Spike Sensitivity
                  </span>
                  <span className="font-mono text-panel-heading font-bold bg-panel-bg px-1.5 py-0.5 border border-panel-border rounded">{alertThreshold.toFixed(2)}%</span>
                </div>
                <input
                  type="range"
                  min="0.10"
                  max="1.50"
                  step="0.05"
                  value={alertThreshold}
                  onChange={(e) => setAlertThreshold(parseFloat(e.target.value))}
                  className="w-full accent-indigo-500 bg-panel-border h-1 rounded cursor-pointer"
                />
              </div>

              {/* Volatility Summary Modal Trigger Button */}
              {onOpenSummaryModal && (
                <button
                  type="button"
                  onClick={onOpenSummaryModal}
                  className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-900/40 hover:bg-indigo-100 dark:hover:bg-indigo-950/50 font-bold text-xs transition cursor-pointer shadow-sm"
                >
                  <Layers size={13} className="text-indigo-500 animate-pulse" />
                  Analyze Volatility Summary
                </button>
              )}

              {/* Feed scroll */}
              <div className="space-y-2 max-h-[160px] overflow-y-auto scrollbar-thin pr-1">
                {alerts.length === 0 ? (
                  <div className="py-6 text-center text-panel-subtext font-mono text-[10px] border border-dashed border-panel-border rounded-xl px-2 leading-relaxed">
                    No extreme spikes over {alertThreshold}% over past {alertWindow} ticks.
                  </div>
                ) : (
                  alerts.filter((alt, idx, self) => self.findIndex(a => a.id === alt.id) === idx).slice(0, 15).map((alt) => {
                    const isGrowth = alt.direction === 'GROWTH';
                    return (
                      <div 
                        key={alt.id}
                        className={`p-2.5 rounded-lg border transition relative text-[11px] ${
                          alt.acknowledged
                            ? 'bg-panel-inner-bg/50 border-panel-border opacity-50'
                            : isGrowth
                              ? 'bg-emerald-100/40 dark:bg-emerald-950/10 border-emerald-200 dark:border-emerald-900/40'
                              : 'bg-rose-100/40 dark:bg-rose-950/10 border-rose-200 dark:border-rose-900/40'
                        }`}
                      >
                        <div className="flex justify-between items-center mb-1">
                          <span className={`font-black font-mono text-[9px] uppercase px-1 py-0.2 rounded ${isGrowth ? 'bg-emerald-200 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400' : 'bg-rose-200 dark:bg-rose-950 text-rose-700 dark:text-rose-400'}`}>
                            {alt.ticker} {isGrowth ? '▲ Growth' : '▼ Drop'}
                          </span>
                          <span className="text-[9px] text-panel-subtext font-mono">{alt.timestamp}</span>
                        </div>
                        <p className="text-panel-heading font-mono text-[10px] leading-tight">
                          Shifted <span className="font-bold">{isGrowth ? '+' : ''}{alt.changePercent.toFixed(2)}%</span>. Price: ${alt.price.toFixed(2)}
                        </p>
                        
                        <div className="flex items-center gap-1.5 mt-2 pt-1.5 border-t border-panel-border/30">
                          <button
                            onClick={() => {
                              setSelectedTicker(alt.ticker);
                              if (onQuickTrade) {
                                onQuickTrade(alt.ticker);
                              } else {
                                executeOrder(alt.ticker, 'BUY', alt.price, 10, 'Manual trade buy signal');
                              }
                            }}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[10px] px-2.5 py-0.5 rounded transition cursor-pointer flex items-center gap-0.5 shadow-sm"
                          >
                            ⚡ Trade
                          </button>
                          {!alt.acknowledged && (
                            <button
                              onClick={() => {
                                setAlerts(prev => prev.map(a => a.id === alt.id ? { ...a, acknowledged: true } : a));
                              }}
                              className="ml-auto text-panel-subtext hover:text-panel-heading text-[9px]"
                            >
                              Dismiss
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'terminal' && (
          <motion.div
            key="terminal-panel"
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ duration: 0.15 }}
            className="space-y-4"
          >
            {/* Quick Action Manual Trader Terminal Override */}
            <div className="bg-panel-bg border border-panel-border rounded-xl p-4 shadow-sm space-y-3 transition-colors">
              <h3 className="text-xs font-bold text-panel-heading tracking-tight flex items-center gap-1.5">
                <Activity size={14} className="text-indigo-500" />
                Execution Override Terminal
              </h3>
              
              <div className="p-3 bg-panel-inner-bg rounded-xl border border-panel-border space-y-2.5 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-panel-subtext">Selected Instrument</span>
                  <span className="font-mono font-bold text-panel-heading">{selectedTicker}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-panel-subtext">Current Fair Price</span>
                  <span className="font-mono font-bold text-panel-heading">${(currentPrices[selectedTicker] || 0).toFixed(2)}</span>
                </div>
                
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-panel-border">
                  <button
                    onClick={() => handleManualTrade('BUY')}
                    className="py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition cursor-pointer text-center"
                  >
                    Quick Buy (10%)
                  </button>
                  <button
                    onClick={() => handleManualTrade('SELL')}
                    className="py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition cursor-pointer text-center"
                  >
                    Quick Sell All
                  </button>
                </div>
              </div>
            </div>

            {/* Active Positions Board */}
            <div className="bg-panel-bg border border-panel-border rounded-xl p-4 shadow-sm space-y-3 transition-colors">
              <div className="flex items-center justify-between border-b border-panel-border pb-2.5">
                <h3 className="text-xs font-bold text-panel-heading tracking-tight flex items-center gap-1.5">
                  <Briefcase size={14} className="text-indigo-500" />
                  Live Portfolio Positions
                </h3>
                <span className="text-[9px] bg-panel-inner-bg border border-panel-border text-panel-subtext px-1.5 py-0.5 rounded-full font-mono font-bold leading-none">
                  {positions.length} Open
                </span>
              </div>

              {positions.length === 0 ? (
                <div className="py-6 text-center text-panel-subtext font-mono text-[10px] border border-dashed border-panel-border rounded-xl">
                  <span>No open stock positions. Bot waiting for buying signal conditions...</span>
                </div>
              ) : (
                <div className="space-y-2 max-h-[160px] overflow-y-auto scrollbar-thin">
                  {positions.map((pos) => {
                    const price = currentPrices[pos.ticker] || pos.averagePrice;
                    const changePct = ((price - pos.averagePrice) / pos.averagePrice) * 100;
                    return (
                      <div 
                        key={pos.ticker}
                        className="p-2.5 bg-panel-inner-bg border border-panel-border rounded-xl flex items-center justify-between hover:border-panel-subtext/30 transition text-xs"
                      >
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold text-panel-heading">{pos.ticker}</span>
                            <span className={`text-[8.5px] font-bold px-1 py-0.2 rounded ${
                              pos.unrealizedPnL >= 0 
                                ? 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400' 
                                : 'bg-rose-100 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400'
                            }`}>
                              {changePct >= 0 ? '+' : ''}{changePct.toFixed(2)}%
                            </span>
                          </div>
                          <p className="text-[10px] text-panel-subtext">
                            Avg: <span className="font-mono text-panel-heading font-semibold">${pos.averagePrice.toFixed(2)}</span> | Qty: <span className="font-mono text-panel-heading font-semibold">{pos.quantity}</span>
                          </p>
                          {pos.trailingStopPrice && (
                            <p className="text-[9px] text-rose-500 font-mono flex items-center gap-0.5 font-semibold">
                              <ShieldAlert size={10} /> Stop Trigger: ${pos.trailingStopPrice.toFixed(2)}
                            </p>
                          )}
                        </div>

                        <div className="text-right space-y-1">
                          <span className={`text-xs font-bold font-mono block ${pos.unrealizedPnL >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                            {pos.unrealizedPnL >= 0 ? '+' : ''}${pos.unrealizedPnL.toFixed(2)}
                          </span>
                          <button
                            onClick={() => executeOrder(pos.ticker, 'SELL', price, pos.quantity, 'Manual liquidating position request.')}
                            className="text-[9px] bg-rose-600 hover:bg-rose-700 text-white font-bold px-1.5 py-0.5 rounded transition cursor-pointer"
                          >
                            Liquidate
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Execution Ledger orders */}
            <div className="bg-panel-bg border border-panel-border rounded-xl p-4 shadow-sm space-y-3 transition-colors">
              <div className="flex items-center justify-between border-b border-panel-border pb-2.5">
                <h3 className="text-xs font-bold text-panel-heading tracking-tight flex items-center gap-1.5">
                  <History size={14} className="text-indigo-500" />
                  Order Execution Ledger
                </h3>
                <span className="text-[9px] text-panel-subtext font-mono">Stream</span>
              </div>

              <div className="space-y-2 max-h-[160px] overflow-y-auto scrollbar-thin pr-1">
                {orders.length === 0 ? (
                  <div className="py-6 text-center text-panel-subtext font-mono text-[10px]">
                    No completed orders. Bot trading signals will populate the ledger.
                  </div>
                ) : (
                  orders.map((order) => (
                    <div 
                      key={order.id} 
                      className="p-2 bg-panel-inner-bg border border-panel-border rounded-lg text-[10px] font-mono space-y-1 hover:border-panel-subtext/30 transition"
                    >
                      <div className="flex items-center justify-between">
                        <span className={`font-bold text-[9.5px] ${order.side === 'BUY' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                          {order.side} FILLED
                        </span>
                        <span className="text-panel-subtext text-[8.5px]">{order.timestamp}</span>
                      </div>
                      <div className="text-panel-heading flex justify-between text-[10px]">
                        <span>{order.quantity} {order.ticker} @ ${order.price.toFixed(2)}</span>
                        <span className="text-panel-subtext font-bold">${order.amount.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between items-center text-[8.5px] text-panel-subtext pt-1 border-t border-panel-border">
                        <span>LATENCY: {order.execution_latency_ms}ms</span>
                        <span>{order.is_live ? '🔴 LIVE' : '🟢 SIM'}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'agents' && (
          <motion.div
            key="agents-panel"
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ duration: 0.15 }}
            className="space-y-4"
          >
            {/* Quantitative Orchestrators status mapping */}
            <div className="bg-panel-bg border border-panel-border rounded-xl p-4 shadow-sm space-y-3 transition-colors">
              <div className="flex items-center justify-between border-b border-panel-border pb-2.5">
                <h3 className="text-xs font-bold text-panel-heading tracking-tight flex items-center gap-1.5">
                  <Cpu className="text-indigo-400 animate-pulse" size={14} />
                  Quant Agent Orchestration
                </h3>
                <button 
                  onClick={() => setAgentLogs([])}
                  className="text-panel-subtext hover:text-panel-heading font-mono text-[9px] hover:underline"
                >
                  Clear Log
                </button>
              </div>

              {/* Grid map for active sub-agents */}
              <div className="space-y-2.5 max-h-[340px] overflow-y-auto pr-1">
                {/* Master Chief */}
                <div className="p-2.5 rounded-lg border border-indigo-900/30 bg-indigo-950/5 flex flex-col gap-1 text-[10.5px]">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 font-bold text-indigo-400">
                      <span>👑 Master Algo Chief</span>
                    </div>
                    <span className="text-[8.5px] text-indigo-400 bg-indigo-950 px-1.5 py-0.2 rounded font-mono font-bold">COORDINATOR</span>
                  </div>
                  <p className="text-[9.5px] text-panel-subtext leading-relaxed">
                    The ultimate trading boss! Coordinates all indicators and translates dry finance numbers into easy toddler words.
                  </p>
                </div>

                {/* Candy Saver */}
                <div className="p-2.5 rounded-lg border border-rose-900/30 bg-rose-950/5 flex flex-col gap-1 text-[10.5px]">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 font-bold text-rose-400">
                      <span>🍬 Super Candy Saver</span>
                    </div>
                    <span className="text-[8.5px] text-rose-400 bg-rose-950 px-1.5 py-0.2 rounded font-mono font-bold">PRESERVATION</span>
                  </div>
                  <p className="text-[9.5px] text-panel-subtext leading-relaxed">
                    Saves your cookie position! Automatically sells some shares if a stock falls down, keeping your money cash-safe in your wallet.
                  </p>
                </div>

                {/* Trend Booster */}
                <div className="p-2.5 rounded-lg border border-emerald-900/30 bg-emerald-950/5 flex flex-col gap-1 text-[10.5px]">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 font-bold text-emerald-400">
                      <span>🚀 Rocket Trend Booster</span>
                    </div>
                    <span className="text-[8.5px] text-emerald-400 bg-emerald-950 px-1.5 py-0.2 rounded font-mono font-bold">BOOSTER</span>
                  </div>
                  <p className="text-[9.5px] text-panel-subtext leading-relaxed">
                    The rocket ship rider! Automatically buys more shares when a stock is going up to win more candy-coins.
                  </p>
                </div>

                {/* Price Detective */}
                <div className="p-2.5 rounded-lg border border-blue-900/30 bg-blue-950/5 flex flex-col gap-1 text-[10.5px]">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 font-bold text-blue-400">
                      <span>🔍 Price Detective</span>
                    </div>
                    <span className="text-[8.5px] text-blue-400 bg-blue-950 px-1.5 py-0.2 rounded font-mono font-bold">CALCULATOR</span>
                  </div>
                  <p className="text-[9.5px] text-panel-subtext leading-relaxed">
                    The chart observer. Looks at price graphs to calculate SMAs, RSIs, and MACDs, drawing candlesticks perfectly.
                  </p>
                </div>

                {/* Portfolio Safety Guard */}
                <div className="p-2.5 rounded-lg border border-amber-900/30 bg-amber-950/5 flex flex-col gap-1 text-[10.5px]">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 font-bold text-amber-400">
                      <span>🛡️ Portfolio Safety Guard</span>
                    </div>
                    <span className="text-[8.5px] text-amber-400 bg-amber-950 px-1.5 py-0.2 rounded font-mono font-bold">RISK CONTROLLER</span>
                  </div>
                  <p className="text-[9.5px] text-panel-subtext leading-relaxed">
                    Your ultimate safety net! Tracks overall gain/loss percentages and executes automatic trailing stops.
                  </p>
                </div>

                {/* Trade Dispatcher */}
                <div className="p-2.5 rounded-lg border border-sky-900/30 bg-sky-950/5 flex flex-col gap-1 text-[10.5px]">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 font-bold text-sky-400">
                      <span>⚡ Trade Dispatcher</span>
                    </div>
                    <span className={`text-[8.5px] font-semibold ${brokerConfig.isLive ? 'text-rose-400' : 'text-sky-400'}`}>
                      {brokerConfig.isLive ? 'Live API' : 'Sandbox active'}
                    </span>
                  </div>
                  <p className="text-[9.5px] text-panel-subtext leading-relaxed">
                    Sends instructions! Routes Buy & Sell signals directly to Alpaca, IBKR, or CCXT paper/live exchange wrappers.
                  </p>
                </div>
              </div>

              {/* Log stream console */}
              <div className="border border-panel-border rounded-xl bg-panel-inner-bg overflow-hidden flex flex-col h-[240px]">
                <div className="bg-panel-bg border-b border-panel-border px-3 py-1.5 flex items-center justify-between text-[10px] text-panel-subtext">
                  <span className="font-mono text-[9px] font-bold">ORCHESTRATION_LOGS</span>
                  <div className="flex gap-1.5">
                    {(['ALL', 'DATA', 'RISK', 'EXEC'] as const).map((tab) => (
                      <button
                        key={tab}
                        onClick={() => setAgentLogSubTab(tab)}
                        className={`px-1.5 py-0.5 rounded text-[8.5px] uppercase font-bold transition ${
                          agentLogSubTab === tab
                            ? 'bg-indigo-600 text-white'
                            : 'text-panel-subtext hover:text-panel-heading'
                        }`}
                      >
                        {tab}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="p-3 font-mono text-[10px] overflow-y-auto flex-1 space-y-1.5 scrollbar-thin select-text">
                  {filteredLogs.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-panel-subtext text-[10px] text-center">
                      Waiting for real-time quantitative events...
                    </div>
                  ) : (
                    filteredLogs.slice().reverse().slice(0, 50).map((log) => {
                      const getAgentColor = (agent: string) => {
                        if (agent === 'DATA_INDICATOR') return 'text-emerald-500';
                        if (agent === 'RISK_PORTFOLIO') return 'text-amber-500';
                        return 'text-sky-500';
                      };
                      return (
                        <div key={log.id} className="border-b border-panel-border/30 pb-1.5 last:border-0 leading-tight">
                          <div className="flex items-center gap-1 text-[8px] text-panel-subtext mb-0.5">
                            <span>{log.timestamp}</span>
                            <span className={`font-bold uppercase ${getAgentColor(log.agent)}`}>
                              [{log.agent === 'DATA_INDICATOR' ? 'DATA' : log.agent === 'RISK_PORTFOLIO' ? 'RISK' : 'EXEC'}]
                            </span>
                            <span className="font-bold opacity-75">({log.type})</span>
                          </div>
                          <p className="text-panel-heading text-[10.5px] font-medium leading-normal break-all">{log.message}</p>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'broker' && (
          <motion.div
            key="broker-panel"
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ duration: 0.15 }}
            className="space-y-4"
          >
            {/* Broker Settings & API Keys Panel */}
            <div className="bg-panel-bg border border-panel-border rounded-xl p-4 shadow-sm space-y-4 transition-colors">
              <div className="flex items-center justify-between border-b border-panel-border pb-2.5">
                <h3 className="text-xs font-bold text-panel-heading tracking-tight flex items-center gap-1.5">
                  <Settings2 size={14} className="text-indigo-500" />
                  Broker Abstraction Config
                </h3>
                <span className="text-[9px] uppercase font-mono bg-panel-inner-bg px-1.5 py-0.5 border border-panel-border rounded text-panel-subtext font-semibold">
                  adapter-v2
                </span>
              </div>

              {/* Provider Selectors */}
              <div className="space-y-1.5">
                <label className="text-[9px] uppercase font-mono font-bold text-panel-subtext">Active Provider</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {(['alpaca', 'ibkr', 'ccxt'] as const).map((prov) => (
                    <button
                      key={prov}
                      type="button"
                      onClick={() => setBrokerConfig({ ...brokerConfig, provider: prov })}
                      className={`py-1 rounded-lg text-xs font-bold capitalize transition cursor-pointer ${
                        brokerConfig.provider === prov
                          ? 'bg-indigo-600 text-white shadow border border-indigo-550'
                          : 'bg-panel-inner-bg text-panel-subtext border border-panel-border hover:bg-panel-border'
                      }`}
                    >
                      {prov}
                    </button>
                  ))}
                </div>
              </div>

              {/* Environmental Guard Switcher */}
              <div className="p-3 rounded-xl border border-dashed border-rose-900/40 bg-rose-950/5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400 flex items-center gap-1">
                    <ShieldAlert size={12} /> Execution Guardrail
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      if (!brokerConfig.isLive) {
                        const yes = window.confirm('⚠️ WARNING: Setting trading environment to LIVE will route execution signals directly to live exchange endpoints. Are you sure you have set valid production keys?');
                        if (yes) {
                          setBrokerConfig({ ...brokerConfig, isLive: true });
                        }
                      } else {
                        setBrokerConfig({ ...brokerConfig, isLive: false });
                      }
                    }}
                    className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider transition cursor-pointer ${
                      brokerConfig.isLive
                        ? 'bg-rose-600 text-white hover:bg-rose-700 shadow shadow-rose-950/40'
                        : 'bg-panel-inner-bg text-panel-heading border border-panel-border hover:bg-panel-border'
                    }`}
                  >
                    {brokerConfig.isLive ? '🔴 LIVE MONEY' : '🟢 SANDBOX'}
                  </button>
                </div>
                <p className="text-[9px] text-panel-subtext leading-relaxed">
                  Enforces complete environment isolation. If sandbox is selected, all real exchange API ports remain locked.
                </p>
              </div>

              {/* Credentials Form */}
              <div className="space-y-2.5 text-xs">
                <div className="space-y-1">
                  <label className="text-[9.5px] font-bold text-panel-subtext uppercase font-mono flex justify-between items-center">
                    <span>API Key ID</span>
                    <span className="text-indigo-400 flex items-center gap-0.5"><Key size={10} /> secure</span>
                  </label>
                  <input
                    type="text"
                    placeholder="MOCK_API_KEY_XXXXXXXX"
                    value={brokerConfig.apiKey}
                    onChange={(e) => setBrokerConfig({ ...brokerConfig, apiKey: e.target.value })}
                    className="w-full bg-panel-inner-bg border border-panel-border rounded-lg px-2.5 py-1.5 font-mono text-panel-heading focus:outline-none focus:border-indigo-500 transition text-[11px]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9.5px] font-bold text-panel-subtext uppercase font-mono">API Secret Key</label>
                  <input
                    type="password"
                    placeholder="••••••••••••••••"
                    value={brokerConfig.apiSecret}
                    onChange={(e) => setBrokerConfig({ ...brokerConfig, apiSecret: e.target.value })}
                    className="w-full bg-panel-inner-bg border border-panel-border rounded-lg px-2.5 py-1.5 font-mono text-panel-heading focus:outline-none focus:border-indigo-500 transition text-[11px]"
                  />
                </div>
              </div>

              {/* Modular Connection Code Generator */}
              <div className="border border-panel-border rounded-xl bg-panel-inner-bg overflow-hidden flex flex-col">
                <div className="bg-panel-bg border-b border-panel-border px-3 py-1.5 flex items-center justify-between text-[10px] text-panel-subtext">
                  <div className="flex items-center gap-1.5 font-mono font-bold text-[9.5px]">
                    <Code size={12} className="text-indigo-400" />
                    <span>Code Snippet Adapter</span>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <div className="flex bg-panel-bg p-0.5 rounded border border-panel-border">
                      <button
                        onClick={() => setSelectedLang('ts')}
                        className={`px-1.5 py-0.2 rounded font-mono text-[8.5px] font-bold transition ${
                          selectedLang === 'ts' ? 'bg-indigo-600 text-white' : 'text-panel-subtext'
                        }`}
                      >
                        TS
                      </button>
                      <button
                        onClick={() => setSelectedLang('py')}
                        className={`px-1.5 py-0.2 rounded font-mono text-[8.5px] font-bold transition ${
                          selectedLang === 'py' ? 'bg-indigo-600 text-white' : 'text-panel-subtext'
                        }`}
                      >
                        PY
                      </button>
                    </div>

                    <button
                      onClick={handleCopy}
                      className="p-1 rounded bg-panel-bg border border-panel-border text-panel-subtext hover:text-panel-heading transition"
                    >
                      {copied ? <Check size={11} className="text-emerald-500" /> : <Copy size={11} />}
                    </button>
                  </div>
                </div>

                <div className="p-3 font-mono text-[9px] overflow-auto text-panel-heading h-[160px] leading-relaxed scrollbar-thin select-text">
                  <pre className="whitespace-pre">
                    {selectedLang === 'ts' ? tsCode : pythonCode}
                  </pre>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'health' && (
          <motion.div
            key="health-panel"
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ duration: 0.15 }}
            className="space-y-4 text-xs"
          >
            {/* Portfolio Health Calculations */}
            {(() => {
              const activePosList = positions
                .filter(p => p.quantity > 0)
                .map(pos => {
                  const price = currentPrices[pos.ticker] || pos.averagePrice;
                  const value = pos.quantity * price;
                  const pnlPercent = pos.averagePrice > 0 ? ((price - pos.averagePrice) / pos.averagePrice) * 100 : 0;
                  return {
                    ticker: pos.ticker,
                    value,
                    pnlPercent,
                    shares: pos.quantity,
                    avgPrice: pos.averagePrice,
                    curPrice: price
                  };
                });

              const totalExposure = activePosList.reduce((sum, p) => sum + p.value, 0);
              const totalEquity = portfolio.cash + totalExposure;
              const marginUtilizationPct = totalEquity > 0 ? (totalExposure / totalEquity) * 100 : 0;
              const marginUtilRounded = Math.min(200, Math.round(marginUtilizationPct));

              // Determine health level
              let healthStatus = 'OPTIMAL';
              let healthColorClass = 'text-emerald-500 bg-emerald-100 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900';
              let healthLabel = 'Conservative Cash Allocation';
              if (marginUtilRounded === 0) {
                healthStatus = 'INACTIVE';
                healthColorClass = 'text-panel-subtext bg-panel-inner-bg border-panel-border';
                healthLabel = 'All positions flat. Holding 100% Cash.';
              } else if (marginUtilRounded > 0 && marginUtilRounded <= 75) {
                healthStatus = 'OPTIMAL';
                healthColorClass = 'text-emerald-500 bg-emerald-100 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900';
                healthLabel = 'Low leverage, safe equity buffers.';
              } else if (marginUtilRounded > 75 && marginUtilRounded <= 100) {
                healthStatus = 'STABLE';
                healthColorClass = 'text-emerald-400 bg-emerald-100 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-950';
                healthLabel = 'Fully allocated cash. No borrowing.';
              } else if (marginUtilRounded > 100 && marginUtilRounded <= 150) {
                healthStatus = 'LEVERAGED';
                healthColorClass = 'text-amber-500 bg-amber-100 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900';
                healthLabel = 'Margin borrowed. High exposure.';
              } else if (marginUtilRounded > 150) {
                healthStatus = 'WARNING';
                healthColorClass = 'text-rose-500 bg-rose-100 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900';
                healthLabel = 'Approaching margin call limits!';
              }

              // Sector Exposure Calculations
              const getSector = (ticker: string): string => {
                const sectors: Record<string, string> = {
                  AAPL: 'Technology',
                  MSFT: 'Technology',
                  NVDA: 'Technology',
                  GOOG: 'Technology',
                  GOOGL: 'Technology',
                  META: 'Technology',
                  TSLA: 'Automotive',
                  COIN: 'Financials',
                  AMZN: 'Consumer Cyclical',
                  NFLX: 'Communication',
                };
                return sectors[ticker] || 'Other';
              };

              const sectorAllocationsMap: Record<string, number> = {};
              activePosList.forEach((pos) => {
                const sector = getSector(pos.ticker);
                sectorAllocationsMap[sector] = (sectorAllocationsMap[sector] || 0) + pos.value;
              });

              if (portfolio.cash > 0) {
                sectorAllocationsMap['Cash'] = portfolio.cash;
              }

              const SECTOR_COLORS: Record<string, string> = {
                'Technology': '#6366f1',
                'Automotive': '#f59e0b',
                'Financials': '#10b981',
                'Consumer Cyclical': '#f43f5e',
                'Communication': '#06b6d4',
                'Other': '#6b7280',
                'Cash': '#475569',
              };

              const sectorChartData = Object.entries(sectorAllocationsMap).map(([name, value]) => ({
                name,
                value,
                color: SECTOR_COLORS[name] || '#6b7280'
              })).sort((a, b) => b.value - a.value);

              const totalSectorValue = Object.values(sectorAllocationsMap).reduce((sum, v) => sum + v, 0);

              // Treemap coordinates
              const mapWidth = 318;
              const mapHeight = 130;
              const treemapRects = activePosList.length > 0 ? computeTreeMap(activePosList, 0, 0, mapWidth, mapHeight) : [];

              return (
                <div className="space-y-4">
                  {/* Status Banner */}
                  <div className="bg-panel-bg border border-panel-border rounded-xl p-4 shadow-sm space-y-3">
                    <div className="flex items-center justify-between border-b border-panel-border pb-2">
                      <h3 className="text-xs font-bold text-panel-heading tracking-tight flex items-center gap-1.5">
                        <HeartPulse size={14} className="text-indigo-500" />
                        Portfolio Health Rating
                      </h3>
                      <span className={`text-[9px] px-2 py-0.5 border rounded-full font-mono font-black ${healthColorClass}`}>
                        {healthStatus}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[10.5px] text-panel-subtext font-medium">{healthLabel}</span>
                    </div>
                  </div>

                  {/* Margin Utilization Bar Card */}
                  <div className="bg-panel-bg border border-panel-border rounded-xl p-4 shadow-sm space-y-3">
                    <h3 className="text-xs font-bold text-panel-heading tracking-tight flex items-center gap-1.5">
                      <Award size={14} className="text-indigo-500" />
                      Margin & Leverage Utilization
                    </h3>
                    
                    <div className="space-y-1.5">
                      <div className="flex justify-between font-mono text-[10px]">
                        <span className="text-panel-subtext">Utilization:</span>
                        <span className="text-panel-heading font-bold">{marginUtilRounded}%</span>
                      </div>
                      
                      {/* Segmented bar */}
                      <div className="h-2 w-full bg-panel-inner-bg rounded-full overflow-hidden flex border border-panel-border/40">
                        <div 
                          className={`h-full transition-all duration-300 ${
                            marginUtilRounded > 150 
                              ? 'bg-rose-500' 
                              : marginUtilRounded > 100 
                              ? 'bg-amber-500' 
                              : 'bg-emerald-500'
                          }`}
                          style={{ width: `${Math.min(100, marginUtilRounded / 2)}%` }} // 200% buying power max
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2 pt-1 font-mono text-[9px] text-panel-subtext">
                        <div>Cash: <span className="text-panel-heading font-bold">{formatPrice(portfolio.cash)}</span></div>
                        <div>Exposure: <span className="text-panel-heading font-bold">{formatPrice(totalExposure)}</span></div>
                        <div className="col-span-2 border-t border-panel-border/30 pt-1 mt-1 flex justify-between">
                          <span>Buying Power Limit:</span>
                          <span className="text-indigo-400 font-bold">{formatPrice(totalEquity * 2)}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Sector Exposure Chart Card */}
                  <div className="bg-panel-bg border border-panel-border rounded-xl p-4 shadow-sm space-y-3">
                    <h3 className="text-xs font-bold text-panel-heading tracking-tight flex items-center gap-1.5">
                      <Briefcase size={14} className="text-indigo-500" />
                      Sector Weight Distribution
                    </h3>

                    {sectorChartData.length === 0 ? (
                      <div className="p-4 text-center text-panel-subtext font-medium text-[10px]">
                        No sector allocations.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="flex justify-center items-center h-[130px] relative">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={sectorChartData}
                                cx="50%"
                                cy="50%"
                                innerRadius={35}
                                outerRadius={55}
                                paddingAngle={3}
                                dataKey="value"
                              >
                                {sectorChartData.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                              </Pie>
                              <RechartsTooltip 
                                formatter={(value: number) => [formatPrice(value), 'Allocation']}
                                contentStyle={{ backgroundColor: 'var(--panel-bg)', borderColor: 'var(--panel-border)', borderRadius: '8px' }}
                              />
                            </PieChart>
                          </ResponsiveContainer>
                          
                          <div className="absolute text-center select-none pointer-events-none">
                            <span className="text-[8px] uppercase tracking-wider text-panel-subtext font-mono">Portfolio</span>
                            <p className="text-[11px] font-black text-panel-heading">{formatPrice(totalEquity)}</p>
                          </div>
                        </div>

                        {/* Sector legend grids */}
                        <div className="grid grid-cols-2 gap-1.5 text-[9.5px]">
                          {sectorChartData.map((item) => {
                            const pct = totalSectorValue > 0 ? (item.value / totalSectorValue) * 100 : 0;
                            return (
                              <div key={item.name} className="flex items-center gap-1.5 justify-between bg-panel-inner-bg p-1.5 rounded-lg border border-panel-border/30">
                                <div className="flex items-center gap-1 min-w-0">
                                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                                  <span className="truncate text-panel-heading font-medium" title={item.name}>{item.name}</span>
                                </div>
                                <span className="font-mono text-[9px] text-panel-subtext font-bold">{pct.toFixed(0)}%</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Active Positions Heat Map Card */}
                  <div className="bg-panel-bg border border-panel-border rounded-xl p-4 shadow-sm space-y-3">
                    <h3 className="text-xs font-bold text-panel-heading tracking-tight flex items-center gap-1.5">
                      <Layers size={14} className="text-indigo-500" />
                      Active Position Heat Map
                    </h3>

                    {activePosList.length === 0 ? (
                      <div className="flex flex-col items-center justify-center p-6 text-center bg-panel-inner-bg rounded-xl border border-dashed border-panel-border space-y-1">
                        <span className="text-panel-subtext text-[10px] leading-snug">No active positions to construct heat map.</span>
                        <p className="text-[8.5px] text-panel-subtext/70">Initiate trade orders in the Terminal or Market Watch tabs first!</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="relative">
                          <svg width="100%" height={mapHeight} className="rounded-xl overflow-hidden border border-panel-border bg-panel-inner-bg/10 shadow-inner">
                            {treemapRects.map((rect) => {
                              const isHovered = hoveredTile?.ticker === rect.ticker;
                              const showLabel = rect.w > 26 && rect.h > 18;
                              const showSubLabel = rect.w > 40 && rect.h > 32;
                              const roundedPnl = rect.pnlPercent.toFixed(1);
                              
                              return (
                                <g 
                                  key={rect.ticker}
                                  onMouseEnter={() => setHoveredTile(rect)}
                                  onMouseLeave={() => setHoveredTile(null)}
                                  onClick={() => setSelectedTicker(rect.ticker)}
                                >
                                  <rect
                                    x={rect.x}
                                    y={rect.y}
                                    width={rect.w}
                                    height={rect.h}
                                    fill={getColorForPnl(rect.pnlPercent)}
                                    stroke="var(--panel-bg)"
                                    strokeWidth={1.5}
                                    className={`transition-all duration-150 cursor-pointer ${
                                      isHovered ? 'brightness-110 saturate-110 opacity-100 filter drop-shadow' : 'opacity-95'
                                    }`}
                                  />
                                  {showLabel && (
                                    <text
                                      x={rect.x + rect.w / 2}
                                      y={rect.y + rect.h / 2 - (showSubLabel ? 5 : 0)}
                                      textAnchor="middle"
                                      dominantBaseline="middle"
                                      className="font-mono text-[9px] font-black fill-slate-950 pointer-events-none select-none tracking-tight"
                                    >
                                      {rect.ticker}
                                    </text>
                                  )}
                                  {showSubLabel && (
                                    <text
                                      x={rect.x + rect.w / 2}
                                      y={rect.y + rect.h / 2 + 7}
                                      textAnchor="middle"
                                      dominantBaseline="middle"
                                      className="font-mono text-[7px] font-bold fill-slate-900 pointer-events-none select-none opacity-80"
                                    >
                                      {rect.pnlPercent > 0 ? '+' : ''}{roundedPnl}%
                                    </text>
                                  )}
                                </g>
                              );
                            })}
                          </svg>
                        </div>

                        {/* Interactive Tooltip / Label */}
                        <div className="bg-panel-inner-bg px-2 py-1 rounded-lg border border-panel-border/30 flex justify-between items-center text-[9.5px]">
                          {hoveredTile ? (
                            <>
                              <span className="font-bold text-panel-heading flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: getColorForPnl(hoveredTile.pnlPercent) }} />
                                {hoveredTile.ticker}:
                              </span>
                              <span className="font-mono text-[9px] text-panel-subtext">
                                Val: <span className="text-panel-heading font-bold">{formatPrice(hoveredTile.value)}</span> | P&L: <span className={hoveredTile.pnlPercent >= 0 ? 'text-emerald-500 font-bold' : 'text-rose-500 font-bold'}>
                                  {hoveredTile.pnlPercent >= 0 ? '+' : ''}{hoveredTile.pnlPercent.toFixed(2)}%
                                </span>
                              </span>
                            </>
                          ) : (
                            <span className="text-panel-subtext flex items-center gap-1">
                              <Info size={11} className="text-indigo-400" />
                              <span>Hover blocks for stats. Click to view on chart.</span>
                            </span>
                          )}
                        </div>

                        {/* Legend */}
                        <div className="flex items-center justify-between text-[8px] font-mono text-panel-subtext pt-0.5">
                          <span>Loss</span>
                          <div className="h-1 w-[120px] rounded-full bg-gradient-to-r from-red-600 via-gray-600 to-emerald-600 border border-panel-border/20" />
                          <span>Gain</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}
          </motion.div>
        )}
      </AnimatePresence>

    </aside>
  );
}

// ----------------------------------------------------------------------
// Helper functions for Portfolio Health / D3-style squarified Treemap layout
// ----------------------------------------------------------------------

interface TreeMapRect {
  ticker: string;
  x: number;
  y: number;
  w: number;
  h: number;
  pnlPercent: number;
  value: number;
}

const computeTreeMap = (
  posList: Array<{ ticker: string; value: number; pnlPercent: number }>,
  x: number,
  y: number,
  w: number,
  h: number
): TreeMapRect[] => {
  if (posList.length === 0) return [];
  if (posList.length === 1) {
    return [{
      ticker: posList[0].ticker,
      x,
      y,
      w,
      h,
      pnlPercent: posList[0].pnlPercent,
      value: posList[0].value
    }];
  }

  const sorted = [...posList].sort((a, b) => b.value - a.value);
  const totalVal = sorted.reduce((sum, p) => sum + p.value, 0);

  let runningSum = 0;
  let splitIdx = 0;
  for (let i = 0; i < sorted.length; i++) {
    runningSum += sorted[i].value;
    if (runningSum >= totalVal / 2 || i === sorted.length - 2) {
      splitIdx = i + 1;
      break;
    }
  }

  const firstHalf = sorted.slice(0, splitIdx);
  const secondHalf = sorted.slice(splitIdx);

  const firstVal = firstHalf.reduce((sum, p) => sum + p.value, 0);
  const ratio = firstVal / totalVal;

  const rects: TreeMapRect[] = [];
  if (w > h) {
    const w1 = w * ratio;
    rects.push(...computeTreeMap(firstHalf, x, y, w1, h));
    rects.push(...computeTreeMap(secondHalf, x + w1, y, w - w1, h));
  } else {
    const h1 = h * ratio;
    rects.push(...computeTreeMap(firstHalf, x, y, w, h1));
    rects.push(...computeTreeMap(secondHalf, x, y + h1, w, h - h1));
  }
  return rects;
};

const getColorForPnl = (pnl: number): string => {
  if (pnl > 4) return '#10b981'; // emerald-500
  if (pnl > 1.5) return '#34d399'; // emerald-400
  if (pnl > 0) return '#a7f3d0'; // emerald-200
  if (pnl === 0) return '#4b5563'; // gray-600
  if (pnl > -1.5) return '#fca5a5'; // red-300
  if (pnl > -4) return '#f87171'; // red-400
  return '#ef4444'; // red-500
};
