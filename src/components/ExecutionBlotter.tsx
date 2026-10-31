/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Order, Position, Portfolio, AgentLog } from '../types';
import { 
  Briefcase, 
  History, 
  Play, 
  Pause, 
  TrendingUp, 
  TrendingDown, 
  CheckCircle2, 
  AlertOctagon, 
  Clock, 
  Zap, 
  Sliders, 
  ArrowUpRight,
  ArrowDownRight,
  Cpu
} from 'lucide-react';

interface ExecutionBlotterProps {
  portfolio: Portfolio;
  positions: Position[];
  orders: Order[];
  agentLogs: AgentLog[];
  automatedTickers: Record<string, boolean>;
  onToggleAutomatedTicker: (ticker: string) => void;
  onExecuteManualOrder: (ticker: string, side: 'BUY' | 'SELL', qty: number) => void;
  onLiquidatePosition: (ticker: string) => void;
  availableTickers: string[];
  currentPrices: Record<string, number>;
}

export function ExecutionBlotter({
  portfolio,
  positions,
  orders,
  agentLogs,
  automatedTickers,
  onToggleAutomatedTicker,
  onExecuteManualOrder,
  onLiquidatePosition,
  availableTickers,
  currentPrices
}: ExecutionBlotterProps) {
  const [orderTicker, setOrderTicker] = useState<string>(availableTickers[0] || 'AAPL');
  const [orderQty, setOrderQty] = useState<number>(10);
  const [activeTab, setActiveTab] = useState<'blotter' | 'positions' | 'automation' | 'audit'>('positions');

  const totalUnrealizedPnL = positions.reduce((acc, p) => acc + p.unrealizedPnL, 0);

  return (
    <div id="execution-blotter-section" className="space-y-5">
      {/* Portfolio Overview Banner */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-2xl backdrop-blur">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-3.5 bg-slate-950/70 border border-slate-800/80 rounded-xl">
            <span className="text-xs text-slate-400 block mb-1">Total Account Balance</span>
            <span className="font-mono text-xl font-bold text-white">${(portfolio.cash + positions.reduce((acc, p) => acc + (p.currentPrice * p.quantity), 0)).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
          </div>

          <div className="p-3.5 bg-slate-950/70 border border-slate-800/80 rounded-xl">
            <span className="text-xs text-slate-400 block mb-1">Available Cash</span>
            <span className="font-mono text-xl font-bold text-emerald-400">${portfolio.cash.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
          </div>

          <div className="p-3.5 bg-slate-950/70 border border-slate-800/80 rounded-xl">
            <span className="text-xs text-slate-400 block mb-1">Unrealized P&L</span>
            <span className={`font-mono text-xl font-bold ${totalUnrealizedPnL >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {totalUnrealizedPnL >= 0 ? '+' : ''}${totalUnrealizedPnL.toFixed(2)}
            </span>
          </div>

          <div className="p-3.5 bg-slate-950/70 border border-slate-800/80 rounded-xl">
            <span className="text-xs text-slate-400 block mb-1">Realized P&L</span>
            <span className={`font-mono text-xl font-bold ${portfolio.realizedPnL >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {portfolio.realizedPnL >= 0 ? '+' : ''}${portfolio.realizedPnL.toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      {/* Manual Quick Order Ticket */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
          <div className="flex items-center gap-2">
            <Zap className="text-amber-400" size={18} />
            <h3 className="text-sm font-bold text-white">Institutional Quick Order Ticket</h3>
          </div>
          <span className="text-xs text-slate-400 font-mono">Market Order Direct Route</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
          <div>
            <label className="text-xs text-slate-400 block mb-1">Ticker Symbol</label>
            <select
              value={orderTicker}
              onChange={(e) => setOrderTicker(e.target.value)}
              className="w-full bg-slate-950 text-white font-mono font-semibold text-sm border border-slate-800 rounded-lg p-2.5 focus:outline-none focus:border-indigo-500"
            >
              {availableTickers.map((t) => (
                <option key={t} value={t}>
                  {t} (${currentPrices[t]?.toFixed(2) || '0.00'})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs text-slate-400 block mb-1">Quantity (Shares/Units)</label>
            <input
              type="number"
              min="1"
              max="1000"
              value={orderQty}
              onChange={(e) => setOrderQty(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-full bg-slate-950 text-white font-mono font-semibold text-sm border border-slate-800 rounded-lg p-2.5 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <button
              onClick={() => onExecuteManualOrder(orderTicker, 'BUY', orderQty)}
              className="w-full flex items-center justify-center gap-1.5 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm rounded-lg shadow-lg shadow-emerald-950/40 transition"
            >
              <ArrowUpRight size={16} /> Market BUY
            </button>
          </div>

          <div>
            <button
              onClick={() => onExecuteManualOrder(orderTicker, 'SELL', orderQty)}
              className="w-full flex items-center justify-center gap-1.5 py-2.5 px-4 bg-rose-600 hover:bg-rose-500 text-white font-bold text-sm rounded-lg shadow-lg shadow-rose-950/40 transition"
            >
              <ArrowDownRight size={16} /> Market SELL
            </button>
          </div>
        </div>
      </div>

      {/* Tabs Navigator */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-2xl">
        <div className="flex border-b border-slate-800 pb-3 gap-2">
          <button
            onClick={() => setActiveTab('positions')}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg transition ${activeTab === 'positions' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-950/50' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
          >
            <Briefcase size={14} /> Active Positions ({positions.length})
          </button>
          <button
            onClick={() => setActiveTab('blotter')}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg transition ${activeTab === 'blotter' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-950/50' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
          >
            <History size={14} /> Order Blotter ({orders.length})
          </button>
          <button
            onClick={() => setActiveTab('automation')}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg transition ${activeTab === 'automation' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-950/50' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
          >
            <Sliders size={14} /> Ticker Automation Toggles
          </button>
          <button
            onClick={() => setActiveTab('audit')}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg transition ${activeTab === 'audit' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-950/50' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
          >
            <Cpu size={14} /> Agent Audit Trail ({agentLogs.length})
          </button>
        </div>

        {/* Tab 1: Active Positions */}
        {activeTab === 'positions' && (
          <div className="mt-4 overflow-x-auto">
            {positions.length > 0 ? (
              <table className="w-full text-left text-xs text-slate-300 font-mono">
                <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="p-3">Ticker</th>
                    <th className="p-3">Quantity</th>
                    <th className="p-3">Avg Fill Price</th>
                    <th className="p-3">Current Price</th>
                    <th className="p-3">Trailing Stop</th>
                    <th className="p-3">Liquidation Target</th>
                    <th className="p-3">Unrealized P&L</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {positions.map((pos) => (
                    <tr key={pos.ticker} className="hover:bg-slate-800/50 transition">
                      <td className="p-3 font-bold text-white">{pos.ticker}</td>
                      <td className="p-3">{pos.quantity}</td>
                      <td className="p-3">${pos.averagePrice.toFixed(2)}</td>
                      <td className="p-3">${pos.currentPrice.toFixed(2)}</td>
                      <td className="p-3 text-amber-400">{pos.trailingStopPrice ? `$${pos.trailingStopPrice.toFixed(2)}` : 'None'}</td>
                      <td className="p-3 text-rose-400">${(pos.averagePrice * 0.85).toFixed(2)}</td>
                      <td className={`p-3 font-bold ${pos.unrealizedPnL >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {pos.unrealizedPnL >= 0 ? '+' : ''}${pos.unrealizedPnL.toFixed(2)}
                      </td>
                      <td className="p-3 text-right">
                        <button
                          onClick={() => onLiquidatePosition(pos.ticker)}
                          className="px-2.5 py-1 bg-rose-950/60 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-900/60 rounded text-[11px] font-sans font-semibold transition"
                        >
                          Liquidate Market
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="p-8 text-center text-slate-500 text-xs font-mono">
                No active positions currently held. Place an order or enable auto-execution.
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Execution Blotter */}
        {activeTab === 'blotter' && (
          <div className="mt-4 overflow-x-auto">
            {orders.length > 0 ? (
              <table className="w-full text-left text-xs text-slate-300 font-mono">
                <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="p-3">Time</th>
                    <th className="p-3">Order ID</th>
                    <th className="p-3">Ticker</th>
                    <th className="p-3">Side</th>
                    <th className="p-3">Type</th>
                    <th className="p-3">Qty</th>
                    <th className="p-3">Price</th>
                    <th className="p-3">Latency</th>
                    <th className="p-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {orders.map((ord) => (
                    <tr key={ord.id} className="hover:bg-slate-800/50 transition">
                      <td className="p-3 text-slate-400">{new Date(ord.timestamp).toLocaleTimeString()}</td>
                      <td className="p-3 font-mono text-[10px] text-slate-400">{ord.id.slice(0, 8)}</td>
                      <td className="p-3 font-bold text-white">{ord.ticker}</td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${ord.side === 'BUY' ? 'bg-emerald-950 text-emerald-400 border border-emerald-900' : 'bg-rose-950 text-rose-400 border border-rose-900'}`}>
                          {ord.side}
                        </span>
                      </td>
                      <td className="p-3">{ord.type}</td>
                      <td className="p-3">{ord.quantity}</td>
                      <td className="p-3">${ord.price.toFixed(2)}</td>
                      <td className="p-3 text-cyan-400">{ord.execution_latency_ms}ms</td>
                      <td className="p-3">
                        <span className="flex items-center gap-1 text-emerald-400 text-[11px]">
                          <CheckCircle2 size={12} /> {ord.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="p-8 text-center text-slate-500 text-xs font-mono">
                Order blotter is empty. Executed orders will log here in real time.
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Ticker Automation Toggles */}
        {activeTab === 'automation' && (
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {availableTickers.map((ticker) => {
              const isEnabled = !!automatedTickers[ticker];
              return (
                <div key={`auto-${ticker}`} className="p-3.5 bg-slate-950/70 border border-slate-800 rounded-xl flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-white font-mono">{ticker}</h4>
                    <span className="text-[10px] text-slate-400 block">Always-on Bot Execution</span>
                  </div>
                  <button
                    onClick={() => onToggleAutomatedTicker(ticker)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${isEnabled ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}
                  >
                    {isEnabled ? <Play size={12} /> : <Pause size={12} />}
                    {isEnabled ? 'ACTIVE' : 'PAUSED'}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Tab 4: Agent Audit Trail */}
        {activeTab === 'audit' && (
          <div className="mt-4 space-y-2 max-h-80 overflow-y-auto pr-1">
            {agentLogs.map((log) => (
              <div key={log.id} className="p-3 bg-slate-950/80 border border-slate-850 rounded-lg flex items-start justify-between font-mono text-xs">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-900">
                      {log.agent}
                    </span>
                    <span className="text-slate-300 font-semibold">{log.message}</span>
                  </div>
                </div>
                <span className="text-[10px] text-slate-500 shrink-0">{new Date(log.timestamp).toLocaleTimeString()}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default ExecutionBlotter;
