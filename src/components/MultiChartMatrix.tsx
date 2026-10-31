/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { 
  ResponsiveContainer, 
  ComposedChart, 
  Line, 
  XAxis, 
  YAxis, 
  Tooltip, 
  Area, 
  Bar, 
  Cell 
} from 'recharts';
import { Candle, ChartMode, TimeframeMode } from '../types';
import { LayoutGrid, TrendingUp, TrendingDown, Maximize2, Activity } from 'lucide-react';

interface MultiChartMatrixProps {
  matrixTickers: string[];
  marketData: Record<string, Candle[]>;
  onSelectTicker: (ticker: string) => void;
  onSetMatrixTicker: (index: number, ticker: string) => void;
  chartMode: ChartMode;
  availableTickers: string[];
  tickerNames: Record<string, string>;
}

export function MultiChartMatrix({
  matrixTickers,
  marketData,
  onSelectTicker,
  onSetMatrixTicker,
  chartMode,
  availableTickers,
  tickerNames,
}: MultiChartMatrixProps) {
  return (
    <div id="multi-chart-matrix" className="space-y-4">
      <div className="flex items-center justify-between bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-xl">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-indigo-950/60 border border-indigo-900/60 rounded-lg text-indigo-400">
            <LayoutGrid size={18} />
          </div>
          <div>
            <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
              4-Way Multi-Chart Real-Time Matrix
            </h2>
            <p className="text-xs text-slate-400">Monitor 4 ticker feeds concurrently with mini-oscillator indicator feeds and individual panning.</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {matrixTickers.map((ticker, idx) => {
          const candles = marketData[ticker] || [];
          const currentCandle = candles[candles.length - 1];
          const prevCandle = candles[candles.length - 2];
          const price = currentCandle ? currentCandle.close : 0;
          const prevPrice = prevCandle ? prevCandle.close : price;
          const changePercent = prevPrice > 0 ? ((price - prevPrice) / prevPrice) * 100 : 0;
          const isUp = changePercent >= 0;

          return (
            <div 
              key={`matrix-card-${ticker}-${idx}`}
              className="bg-slate-900/90 border border-slate-800 hover:border-indigo-900/60 rounded-xl p-4 shadow-2xl transition duration-200 flex flex-col"
            >
              {/* Card Header */}
              <div className="flex items-center justify-between mb-3 border-b border-slate-800/80 pb-3">
                <div className="flex items-center gap-2">
                  <select
                    value={ticker}
                    onChange={(e) => onSetMatrixTicker(idx, e.target.value)}
                    className="bg-slate-950 text-white font-bold text-sm border border-slate-800 rounded-lg px-2.5 py-1 focus:outline-none focus:border-indigo-500 font-mono"
                  >
                    {availableTickers.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                  <span className="text-xs text-slate-400 truncate max-w-[140px]">
                    {tickerNames[ticker] || ticker}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <div className={`flex items-center gap-1 text-xs font-mono font-bold px-2 py-0.5 rounded ${isUp ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-900/50' : 'bg-rose-950/40 text-rose-400 border border-rose-900/50'}`}>
                    {isUp ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                    <span>${price.toFixed(2)}</span>
                    <span className="text-[10px]">({isUp ? '+' : ''}{changePercent.toFixed(2)}%)</span>
                  </div>

                  <button
                    onClick={() => onSelectTicker(ticker)}
                    title="Focus in High-Depth Single View"
                    className="p-1.5 bg-slate-800 hover:bg-indigo-600 text-slate-300 hover:text-white rounded-lg transition"
                  >
                    <Maximize2 size={13} />
                  </button>
                </div>
              </div>

              {/* Price Chart Container */}
              <div className="h-44 w-full relative">
                {candles.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={candles} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                      <XAxis dataKey="time" hide />
                      <YAxis domain={['auto', 'auto']} tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#090d16', borderColor: '#1e293b', borderRadius: '8px', fontSize: '11px', color: '#f8fafc' }}
                      />
                      {chartMode === 'area' ? (
                        <Area type="monotone" dataKey="close" stroke={isUp ? '#10b981' : '#f43f5e'} fill={isUp ? '#10b981' : '#f43f5e'} fillOpacity={0.15} strokeWidth={2} dot={false} />
                      ) : (
                        <Line type="monotone" dataKey="close" stroke={isUp ? '#10b981' : '#f43f5e'} strokeWidth={2} dot={false} isAnimationActive={false} />
                      )}
                    </ComposedChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-xs text-slate-500 font-mono">
                    Loading feed...
                  </div>
                )}
              </div>

              {/* Mini Indicator Bar */}
              <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[11px] font-mono text-slate-400">
                <div className="flex items-center gap-2">
                  <Activity size={12} className="text-indigo-400" />
                  <span>RSI: <strong className="text-white">{currentCandle?.indicators?.rsi?.toFixed(1) ?? 'N/A'}</strong></span>
                </div>
                <div>
                  <span>ATR: <strong className="text-white">{currentCandle?.indicators?.atr?.toFixed(2) ?? 'N/A'}</strong></span>
                </div>
                <div>
                  <span>Vol: <strong className="text-white">{currentCandle ? (currentCandle.volume / 1000).toFixed(0) + 'k' : '0'}</strong></span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default MultiChartMatrix;
