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
  Bar, 
  ReferenceLine, 
  Area,
  Cell
} from 'recharts';
import { Candle, CrosshairState } from '../types';
import { Activity, BarChart2, Zap, Sliders, Waves } from 'lucide-react';

interface StackedOscillatorsProps {
  candles: Candle[];
  crosshair: CrosshairState;
  onMouseMove?: (state: any, e: any) => void;
  onMouseLeave?: () => void;
}

export function StackedOscillators({
  candles,
  crosshair,
  onMouseMove,
  onMouseLeave
}: StackedOscillatorsProps) {
  if (!candles || candles.length === 0) return null;

  return (
    <div className="space-y-3 mt-4">
      {/* 1. Volume Panel */}
      <div className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-3 shadow-lg relative relative-chart-container">
        <div className="flex items-center justify-between mb-1.5 px-1">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-300">
            <BarChart2 size={13} className="text-cyan-400" />
            <span>Volume (24h)</span>
          </div>
          <span className="font-mono text-[11px] text-slate-400">
            Latest: {candles[candles.length - 1]?.volume.toLocaleString() || '0'}
          </span>
        </div>
        <div className="h-24 w-full relative">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={candles} onMouseMove={onMouseMove} onMouseLeave={onMouseLeave} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <XAxis dataKey="time" hide />
              <YAxis domain={[0, 'auto']} tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip 
                contentStyle={{ backgroundColor: '#090d16', borderColor: '#1e293b', borderRadius: '8px', fontSize: '11px', color: '#f8fafc' }}
                formatter={(val: any) => [Number(val).toLocaleString(), 'Volume']}
              />
              {crosshair.enabled && crosshair.label && (
                <ReferenceLine x={crosshair.label} stroke="#6366f1" strokeWidth={1} strokeDasharray="3 3" />
              )}
              <Bar dataKey="volume" radius={[2, 2, 0, 0]}>
                {candles.map((entry, index) => {
                  const isUp = entry.close >= entry.open;
                  return <Cell key={`vol-${index}`} fill={isUp ? '#10b981' : '#f43f5e'} opacity={0.7} />;
                })}
              </Bar>
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 2. RSI Panel (14) */}
      <div className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-3 shadow-lg relative relative-chart-container">
        <div className="flex items-center justify-between mb-1.5 px-1">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-indigo-400">
            <Zap size={13} />
            <span>RSI (14) Relative Strength Index</span>
          </div>
          <div className="flex items-center gap-3 text-[11px] font-mono">
            <span className="text-rose-400">OB: 70</span>
            <span className="text-emerald-400">OS: 30</span>
            <span className="text-white font-semibold">
              Val: {candles[candles.length - 1]?.indicators?.rsi?.toFixed(1) ?? 'N/A'}
            </span>
          </div>
        </div>
        <div className="h-28 w-full relative">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={candles} onMouseMove={onMouseMove} onMouseLeave={onMouseLeave} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <XAxis dataKey="time" hide />
              <YAxis domain={[0, 100]} ticks={[30, 50, 70]} tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip 
                contentStyle={{ backgroundColor: '#090d16', borderColor: '#1e293b', borderRadius: '8px', fontSize: '11px', color: '#f8fafc' }}
                formatter={(val: any) => [val, 'RSI (14)']}
              />
              <ReferenceLine y={70} stroke="#f43f5e" strokeDasharray="3 3" strokeWidth={1} label={{ value: '70 OB', fill: '#f43f5e', fontSize: 9, position: 'right' }} />
              <ReferenceLine y={30} stroke="#10b981" strokeDasharray="3 3" strokeWidth={1} label={{ value: '30 OS', fill: '#10b981', fontSize: 9, position: 'right' }} />
              <ReferenceLine y={50} stroke="#475569" strokeDasharray="2 2" strokeWidth={0.8} />
              {crosshair.enabled && crosshair.label && (
                <ReferenceLine x={crosshair.label} stroke="#6366f1" strokeWidth={1} strokeDasharray="3 3" />
              )}
              <Area type="monotone" dataKey="indicators.rsi" stroke="#818cf8" fill="#6366f1" fillOpacity={0.15} strokeWidth={2} dot={false} isAnimationActive={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 3. MACD Panel */}
      <div className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-3 shadow-lg relative relative-chart-container">
        <div className="flex items-center justify-between mb-1.5 px-1">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-400">
            <Activity size={13} />
            <span>MACD (12, 26, 9) Oscillator</span>
          </div>
          <div className="flex items-center gap-3 text-[11px] font-mono">
            <span className="text-amber-400">Line: {candles[candles.length - 1]?.indicators?.macd?.macdLine?.toFixed(2) ?? 'N/A'}</span>
            <span className="text-sky-400">Signal: {candles[candles.length - 1]?.indicators?.macd?.signalLine?.toFixed(2) ?? 'N/A'}</span>
            <span className="text-emerald-400">Hist: {candles[candles.length - 1]?.indicators?.macd?.histogram?.toFixed(2) ?? 'N/A'}</span>
          </div>
        </div>
        <div className="h-28 w-full relative">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={candles} onMouseMove={onMouseMove} onMouseLeave={onMouseLeave} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <XAxis dataKey="time" hide />
              <YAxis domain={['auto', 'auto']} tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip 
                contentStyle={{ backgroundColor: '#090d16', borderColor: '#1e293b', borderRadius: '8px', fontSize: '11px', color: '#f8fafc' }}
              />
              <ReferenceLine y={0} stroke="#475569" strokeWidth={1} />
              {crosshair.enabled && crosshair.label && (
                <ReferenceLine x={crosshair.label} stroke="#6366f1" strokeWidth={1} strokeDasharray="3 3" />
              )}
              <Bar dataKey="indicators.macd.histogram" radius={[2, 2, 0, 0]}>
                {candles.map((entry, index) => {
                  const hist = entry.indicators?.macd?.histogram ?? 0;
                  return <Cell key={`macd-hist-${index}`} fill={hist >= 0 ? '#10b981' : '#f43f5e'} opacity={0.8} />;
                })}
              </Bar>
              <Line type="monotone" dataKey="indicators.macd.macdLine" stroke="#f59e0b" strokeWidth={1.8} dot={false} isAnimationActive={false} />
              <Line type="monotone" dataKey="indicators.macd.signalLine" stroke="#38bdf8" strokeWidth={1.5} strokeDasharray="3 3" dot={false} isAnimationActive={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 4. Stochastic Panel (%K / %D) */}
      <div className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-3 shadow-lg relative relative-chart-container">
        <div className="flex items-center justify-between mb-1.5 px-1">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-purple-400">
            <Sliders size={13} />
            <span>Stochastic %K / %D (14, 3)</span>
          </div>
          <div className="flex items-center gap-3 text-[11px] font-mono">
            <span className="text-purple-400">%K: {candles[candles.length - 1]?.indicators?.stochastic?.k?.toFixed(1) ?? 'N/A'}</span>
            <span className="text-pink-400">%D: {candles[candles.length - 1]?.indicators?.stochastic?.d?.toFixed(1) ?? 'N/A'}</span>
          </div>
        </div>
        <div className="h-24 w-full relative">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={candles} onMouseMove={onMouseMove} onMouseLeave={onMouseLeave} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <XAxis dataKey="time" hide />
              <YAxis domain={[0, 100]} ticks={[20, 80]} tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip 
                contentStyle={{ backgroundColor: '#090d16', borderColor: '#1e293b', borderRadius: '8px', fontSize: '11px', color: '#f8fafc' }}
              />
              <ReferenceLine y={80} stroke="#f43f5e" strokeDasharray="3 3" strokeWidth={1} />
              <ReferenceLine y={20} stroke="#10b981" strokeDasharray="3 3" strokeWidth={1} />
              {crosshair.enabled && crosshair.label && (
                <ReferenceLine x={crosshair.label} stroke="#6366f1" strokeWidth={1} strokeDasharray="3 3" />
              )}
              <Line type="monotone" dataKey="indicators.stochastic.k" stroke="#c084fc" strokeWidth={1.8} dot={false} isAnimationActive={false} />
              <Line type="monotone" dataKey="indicators.stochastic.d" stroke="#f472b6" strokeWidth={1.5} strokeDasharray="3 3" dot={false} isAnimationActive={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 5. ATR Volatility Panel */}
      <div className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-3 shadow-lg relative relative-chart-container">
        <div className="flex items-center justify-between mb-1.5 px-1">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
            <Waves size={13} />
            <span>ATR (14) Average True Range Volatility</span>
          </div>
          <span className="font-mono text-[11px] text-emerald-300 font-semibold">
            Latest: {candles[candles.length - 1]?.indicators?.atr?.toFixed(3) ?? 'N/A'}
          </span>
        </div>
        <div className="h-24 w-full relative">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={candles} onMouseMove={onMouseMove} onMouseLeave={onMouseLeave} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <XAxis dataKey="time" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={{ stroke: '#1e293b' }} tickLine={false} />
              <YAxis domain={['auto', 'auto']} tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip 
                contentStyle={{ backgroundColor: '#090d16', borderColor: '#1e293b', borderRadius: '8px', fontSize: '11px', color: '#f8fafc' }}
                formatter={(val: any) => [val, 'ATR (14)']}
              />
              {crosshair.enabled && crosshair.label && (
                <ReferenceLine x={crosshair.label} stroke="#6366f1" strokeWidth={1} strokeDasharray="3 3" />
              )}
              <Area type="monotone" dataKey="indicators.atr" stroke="#34d399" fill="#059669" fillOpacity={0.15} strokeWidth={1.8} dot={false} isAnimationActive={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

export default StackedOscillators;
