/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Sliders, RefreshCw, Info, HelpCircle } from 'lucide-react';
import { Strategy, StrategyParameters } from '../types';

interface StrategyBuilderProps {
  strategy: Strategy;
  onChangeStrategy: (strategy: Strategy) => void;
}

export default function StrategyBuilder({ strategy, onChangeStrategy }: StrategyBuilderProps) {
  const updateParam = (key: keyof Strategy['parameters'], value: any) => {
    onChangeStrategy({
      ...strategy,
      parameters: {
        ...strategy.parameters,
        [key]: value,
      },
    });
  };

  const resetStrategy = () => {
    onChangeStrategy({
      id: 'default',
      name: 'Dynamic Technical Convergence',
      description: 'Golden Cross, RSI Overbought/Oversold Crossovers, Infinitron Pivot Breakouts, and MACD Momentum confluence strategy.',
      parameters: {
        rsiOverbought: 70,
        rsiOversold: 30,
        smaShortPeriod: 10,
        smaLongPeriod: 30,
        macdFastPeriod: 12,
        macdSlowPeriod: 26,
        macdSignalPeriod: 9,
        trailingStopPercent: 2.0,
        riskRewardRatio: 2.0,
        stopLossPercent: 1.5,
        takeProfitPercent: 3.0,
        infinitronPivotPeriod: 4,
        useSmaCross: true,
        useRsiBreach: true,
        useMacdCross: true,
        usePivotTrigger: true,
      },
    });
  };

  const params: StrategyParameters = strategy.parameters || ({} as StrategyParameters);

  return (
    <div id="strategy-builder-panel" className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-2xl backdrop-blur">
      <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-5">
        <div className="flex items-center gap-2">
          <Sliders className="text-indigo-400" size={20} />
          <div>
            <h2 className="text-lg font-bold text-white tracking-tight">
              Visual Algorithmic Strategy & Risk Builder
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">Define mathematical trigger conditions, Infinitron pivot breakouts, and risk-to-reward parameters.</p>
          </div>
        </div>
        <button
          onClick={resetStrategy}
          className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-800 hover:border-slate-750 text-xs rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white transition"
        >
          <RefreshCw size={12} /> Reset Defaults
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* RSI Parameters */}
        <div className="p-4 bg-slate-950/70 border border-slate-850 rounded-xl space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-indigo-400 uppercase tracking-widest">Relative Strength Index</h3>
            <label className="flex items-center gap-1 text-[10px] text-indigo-300 cursor-pointer">
              <input 
                type="checkbox" 
                checked={params.useRsiBreach ?? true} 
                onChange={(e) => updateParam('useRsiBreach', e.target.checked)} 
                className="accent-indigo-500 rounded" 
              />
              Enable
            </label>
          </div>

          <div className="space-y-4 pt-1">
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-slate-400">
                <span>Overbought Threshold</span>
                <span className="font-mono text-white font-semibold">{params.rsiOverbought ?? 70}</span>
              </div>
              <input
                type="range"
                min="60"
                max="85"
                step="1"
                value={params.rsiOverbought ?? 70}
                onChange={(e) => updateParam('rsiOverbought', parseInt(e.target.value))}
                className="w-full accent-indigo-500 bg-slate-800 h-1 rounded"
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-xs text-slate-400">
                <span>Oversold Threshold</span>
                <span className="font-mono text-white font-semibold">{params.rsiOversold ?? 30}</span>
              </div>
              <input
                type="range"
                min="15"
                max="40"
                step="1"
                value={params.rsiOversold ?? 30}
                onChange={(e) => updateParam('rsiOversold', parseInt(e.target.value))}
                className="w-full accent-indigo-500 bg-slate-800 h-1 rounded"
              />
            </div>
          </div>
          <p className="text-[10px] text-slate-500 leading-normal flex items-start gap-1">
            <Info size={11} className="shrink-0 mt-0.5 text-indigo-400/70" />
            Triggers BUY when RSI crosses above oversold, and SELL when crossing below overbought bounds.
          </p>
        </div>

        {/* SMA Golden Cross */}
        <div className="p-4 bg-slate-950/70 border border-slate-850 rounded-xl space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-emerald-400 uppercase tracking-widest">Moving Averages</h3>
            <label className="flex items-center gap-1 text-[10px] text-emerald-300 cursor-pointer">
              <input 
                type="checkbox" 
                checked={params.useSmaCross ?? true} 
                onChange={(e) => updateParam('useSmaCross', e.target.checked)} 
                className="accent-emerald-500 rounded" 
              />
              Enable
            </label>
          </div>

          <div className="space-y-4 pt-1">
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-slate-400">
                <span>Short SMA Period</span>
                <span className="font-mono text-white font-semibold">{params.smaShortPeriod ?? 10} candles</span>
              </div>
              <input
                type="range"
                min="5"
                max="25"
                step="1"
                value={params.smaShortPeriod ?? 10}
                onChange={(e) => updateParam('smaShortPeriod', parseInt(e.target.value))}
                className="w-full accent-emerald-500 bg-slate-800 h-1 rounded"
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-xs text-slate-400">
                <span>Long SMA Period</span>
                <span className="font-mono text-white font-semibold">{params.smaLongPeriod ?? 30} candles</span>
              </div>
              <input
                type="range"
                min="20"
                max="100"
                step="1"
                value={params.smaLongPeriod ?? 30}
                onChange={(e) => updateParam('smaLongPeriod', parseInt(e.target.value))}
                className="w-full accent-emerald-500 bg-slate-800 h-1 rounded"
              />
            </div>
          </div>
          <p className="text-[10px] text-slate-500 leading-normal flex items-start gap-1">
            <Info size={11} className="shrink-0 mt-0.5 text-emerald-400/70" />
            Golden Cross: Buy signal when Short SMA crosses above Long SMA. Death Cross: Sell signal when crossing below.
          </p>
        </div>

        {/* Infinitron Pivot Breakout */}
        <div className="p-4 bg-slate-950/70 border border-slate-850 rounded-xl space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-cyan-400 uppercase tracking-widest">Infinitron Pivots</h3>
            <label className="flex items-center gap-1 text-[10px] text-cyan-300 cursor-pointer">
              <input 
                type="checkbox" 
                checked={params.usePivotTrigger ?? true} 
                onChange={(e) => updateParam('usePivotTrigger', e.target.checked)} 
                className="accent-cyan-500 rounded" 
              />
              Enable
            </label>
          </div>

          <div className="space-y-4 pt-1">
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-slate-400">
                <span>Swing Lookback Window</span>
                <span className="font-mono text-white font-semibold">{params.infinitronPivotPeriod ?? 4} bars</span>
              </div>
              <input
                type="range"
                min="2"
                max="10"
                step="1"
                value={params.infinitronPivotPeriod ?? 4}
                onChange={(e) => updateParam('infinitronPivotPeriod', parseInt(e.target.value))}
                className="w-full accent-cyan-500 bg-slate-800 h-1 rounded"
              />
            </div>

            <div className="p-2.5 rounded-lg bg-cyan-950/15 border border-cyan-900/30">
              <span className="text-[10px] font-semibold text-cyan-400 block mb-1">Pivot Breakout Trigger</span>
              <p className="text-[9.5px] text-slate-400 leading-relaxed">
                Triggers BUY when candle close breaks above Resistance S&R level, and SELL when breaking below Support level.
              </p>
            </div>
          </div>
        </div>

        {/* Risk & Reward Multipliers */}
        <div className="p-4 bg-slate-950/70 border border-slate-850 rounded-xl space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-rose-400 uppercase tracking-widest">Risk & Reward Profile</h3>
            <span className="text-[10px] bg-rose-950/40 text-rose-300 border border-rose-900/55 px-1.5 py-0.5 rounded">RISK/REWARD</span>
          </div>

          <div className="space-y-4 pt-1">
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-slate-400">
                <span>Risk : Reward Ratio</span>
                <span className="font-mono text-white font-semibold">1 : {params.riskRewardRatio ?? 2.0}</span>
              </div>
              <input
                type="range"
                min="1.0"
                max="4.0"
                step="0.1"
                value={params.riskRewardRatio ?? 2.0}
                onChange={(e) => updateParam('riskRewardRatio', parseFloat(e.target.value))}
                className="w-full accent-rose-500 bg-slate-800 h-1 rounded"
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-xs text-slate-400">
                <span>Trailing Stop Loss %</span>
                <span className="font-mono text-white font-semibold">{(params.trailingStopPercent ?? 2.0).toFixed(1)}%</span>
              </div>
              <input
                type="range"
                min="0.5"
                max="5.0"
                step="0.1"
                value={params.trailingStopPercent ?? 2.0}
                onChange={(e) => updateParam('trailingStopPercent', parseFloat(e.target.value))}
                className="w-full accent-rose-500 bg-slate-800 h-1 rounded"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
