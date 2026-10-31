/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { 
  Play, 
  TrendingUp, 
  Coins, 
  ShieldAlert, 
  FileText, 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  Sliders, 
  HelpCircle,
  Award,
  ChevronDown,
  Info,
  Calendar
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  ComposedChart, 
  Line, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid, 
  Legend 
} from 'recharts';
import { OHLCV } from '../types';
import { calculateRSI } from '../utils/indicators';

interface StrategyBacktesterProps {
  candles: OHLCV[];
  selectedTicker: string;
  tickers: string[];
  onChangeTicker?: (ticker: string) => void;
  defaultRsiOverbought?: number;
  defaultRsiOversold?: number;
  defaultTrailingStop?: number;
}

interface BacktestTrade {
  id: string;
  type: 'LONG';
  entryTime: string;
  exitTime: string;
  entryPrice: number;
  exitPrice: number;
  shares: number;
  profit: number;
  profitPercent: number;
  reason: string;
}

interface EquityPoint {
  time: string;
  equity: number;
  buyAndHold: number;
  price: number;
  rsi: number | undefined;
}

export default function StrategyBacktester({
  candles,
  selectedTicker,
  tickers,
  onChangeTicker,
  defaultRsiOverbought = 70,
  defaultRsiOversold = 30,
  defaultTrailingStop = 2.0
}: StrategyBacktesterProps) {
  // Backtest parameters
  const [ticker, setTicker] = useState<string>(selectedTicker);
  const [rsiPeriod, setRsiPeriod] = useState<number>(14);
  const [rsiOverbought, setRsiOverbought] = useState<number>(defaultRsiOverbought);
  const [rsiOversold, setRsiOversold] = useState<number>(defaultRsiOversold);
  const [trailingStop, setTrailingStop] = useState<number>(defaultTrailingStop);
  const [enableTrailingStop, setEnableTrailingStop] = useState<boolean>(true);
  const [startingBalance, setStartingBalance] = useState<number>(10000);
  const [entryTriggerType, setEntryTriggerType] = useState<'crossover' | 'level'>('crossover');
  const [exitTriggerType, setExitTriggerType] = useState<'crossover' | 'level'>('level');
  const [showTradesTable, setShowTradesTable] = useState<boolean>(true);

  // Synchronize ticker when parent changes
  React.useEffect(() => {
    setTicker(selectedTicker);
  }, [selectedTicker]);

  // Handle local ticker selection change
  const handleTickerChange = (newTicker: string) => {
    setTicker(newTicker);
    if (onChangeTicker) {
      onChangeTicker(newTicker);
    }
  };

  // Run the backtest simulation
  const backtestResults = useMemo(() => {
    if (!candles || candles.length === 0) {
      return {
        trades: [],
        equityCurve: [],
        metrics: {
          endingBalance: startingBalance,
          netProfit: 0,
          netProfitPercent: 0,
          winRate: 0,
          profitFactor: '0.00',
          totalTrades: 0,
          winningTrades: 0,
          losingTrades: 0,
          maxDrawdown: 0,
          buyAndHoldProfitPercent: 0,
        }
      };
    }

    const prices = candles.map(c => c.close);
    const rsiValues = calculateRSI(prices, rsiPeriod);

    let cash = startingBalance;
    let positionSize = 0; // shares
    let entryPrice = 0;
    let entryTime = '';
    let peakPrice = 0;
    const trades: BacktestTrade[] = [];
    const equityCurve: EquityPoint[] = [];

    const initialPrice = candles[0]?.close || 1.0;
    const buyAndHoldShares = startingBalance / initialPrice;

    for (let i = 0; i < candles.length; i++) {
      const candle = candles[i];
      const currentPrice = candle.close;
      const currentRsi = rsiValues[i];
      const prevRsi = i > 0 ? rsiValues[i - 1] : undefined;
      const hasPosition = positionSize > 0;

      // Current portfolio equity value
      const currentEquity = cash + (positionSize * currentPrice);
      const currentBuyAndHoldEquity = buyAndHoldShares * currentPrice;

      // Track trailing stop peak price
      if (hasPosition && currentPrice > peakPrice) {
        peakPrice = currentPrice;
      }

      // Check exit condition if in position
      let isExitTriggered = false;
      let exitReason = '';

      if (hasPosition) {
        // Trailing stop loss check
        if (enableTrailingStop && trailingStop > 0) {
          const stopPrice = peakPrice * (1 - trailingStop / 100);
          if (currentPrice <= stopPrice) {
            isExitTriggered = true;
            exitReason = `Stop Loss (${trailingStop}%)`;
          }
        }

        // RSI Overbought exit check
        if (!isExitTriggered && currentRsi !== undefined) {
          if (exitTriggerType === 'crossover') {
            // Crosses down from overbought boundary
            if (prevRsi !== undefined && prevRsi >= rsiOverbought && currentRsi < rsiOverbought) {
              isExitTriggered = true;
              exitReason = 'RSI Overbought Cross Down';
            }
          } else {
            // Touches or exceeds overbought level
            if (currentRsi >= rsiOverbought) {
              isExitTriggered = true;
              exitReason = 'RSI Overbought Level';
            }
          }
        }

        // Final exit on last candle to cash out and evaluate performance
        if (i === candles.length - 1 && !isExitTriggered) {
          isExitTriggered = true;
          exitReason = 'End of History';
        }

        // Execute EXIT trade
        if (isExitTriggered) {
          const tradeProfit = (currentPrice - entryPrice) * positionSize;
          const tradeProfitPercent = ((currentPrice - entryPrice) / entryPrice) * 100;
          cash += positionSize * currentPrice;

          trades.push({
            id: `trade-${trades.length + 1}`,
            type: 'LONG',
            entryTime,
            exitTime: candle.time,
            entryPrice,
            exitPrice: currentPrice,
            shares: positionSize,
            profit: Number(tradeProfit.toFixed(2)),
            profitPercent: Number(tradeProfitPercent.toFixed(2)),
            reason: exitReason
          });

          positionSize = 0;
        }
      }

      // Check entry condition if NOT in position (and not on the last candle)
      if (positionSize === 0 && i < candles.length - 1 && currentRsi !== undefined) {
        let isEntryTriggered = false;

        if (entryTriggerType === 'crossover') {
          // Crosses up from oversold boundary
          if (prevRsi !== undefined && prevRsi <= rsiOversold && currentRsi > rsiOversold) {
            isEntryTriggered = true;
          }
        } else {
          // Touches or falls below oversold level
          if (currentRsi <= rsiOversold) {
            isEntryTriggered = true;
          }
        }

        // Execute ENTRY trade
        if (isEntryTriggered) {
          const sharesToBuy = Math.floor(cash / currentPrice);
          if (sharesToBuy > 0) {
            positionSize = sharesToBuy;
            entryPrice = currentPrice;
            entryTime = candle.time;
            peakPrice = currentPrice;
            cash -= sharesToBuy * currentPrice;
          }
        }
      }

      // Record portfolio snapshots for the charting area
      equityCurve.push({
        time: candle.time,
        equity: Number((cash + (positionSize * currentPrice)).toFixed(2)),
        buyAndHold: Number(currentBuyAndHoldEquity.toFixed(2)),
        price: currentPrice,
        rsi: currentRsi
      });
    }

    // Calculate metrics
    const finalEquity = equityCurve[equityCurve.length - 1]?.equity || startingBalance;
    const netProfit = finalEquity - startingBalance;
    const netProfitPercent = (netProfit / startingBalance) * 100;

    const totalTrades = trades.length;
    const winningTrades = trades.filter(t => t.profit > 0).length;
    const losingTrades = totalTrades - winningTrades;
    const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;

    const grossProfit = trades.filter(t => t.profit > 0).reduce((sum, t) => sum + t.profit, 0);
    const grossLoss = trades.filter(t => t.profit <= 0).reduce((sum, t) => sum + Math.abs(t.profit), 0);
    
    let profitFactor = '0.00';
    if (grossLoss === 0) {
      profitFactor = grossProfit > 0 ? 'Max (No Losses)' : '0.00';
    } else {
      profitFactor = (grossProfit / grossLoss).toFixed(2);
    }

    // Calculate max drawdown
    let maxDd = 0;
    let peak = startingBalance;
    equityCurve.forEach(pt => {
      if (pt.equity > peak) {
        peak = pt.equity;
      }
      const dd = ((peak - pt.equity) / peak) * 100;
      if (dd > maxDd) {
        maxDd = dd;
      }
    });

    const lastPrice = candles[candles.length - 1]?.close || 1.0;
    const buyAndHoldProfitPercent = ((lastPrice - initialPrice) / initialPrice) * 100;

    return {
      trades,
      equityCurve,
      metrics: {
        endingBalance: finalEquity,
        netProfit,
        netProfitPercent,
        winRate,
        profitFactor,
        totalTrades,
        winningTrades,
        losingTrades,
        maxDrawdown: maxDd,
        buyAndHoldProfitPercent,
      }
    };
  }, [candles, rsiPeriod, rsiOverbought, rsiOversold, trailingStop, enableTrailingStop, startingBalance, entryTriggerType, exitTriggerType]);

  const { trades, equityCurve, metrics } = backtestResults;

  // Render a mini color badge for profit factor
  const profitFactorColor = () => {
    if (metrics.profitFactor === 'Max (No Losses)') return 'text-emerald-500 bg-emerald-500/10 border-emerald-500/30';
    const pfNum = parseFloat(metrics.profitFactor);
    if (pfNum >= 1.7) return 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20';
    if (pfNum >= 1.0) return 'text-amber-500 bg-amber-500/10 border-amber-500/20';
    return 'text-rose-500 bg-rose-500/10 border-rose-500/20';
  };

  return (
    <div id="strategy-backtester-container" className="bg-panel-bg border border-panel-border rounded-xl p-5 shadow-sm space-y-5 transition-colors duration-200">
      
      {/* Panel Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-panel-border pb-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-500 dark:text-indigo-400">
            <TrendingUp size={20} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-panel-heading uppercase tracking-wider font-mono">
              RSI Strategy Historical Backtester
            </h3>
            <p className="text-[11px] text-panel-subtext mt-0.5">
              Simulate technical crossover logic against historical candles to measure performance indicators.
            </p>
          </div>
        </div>

        {/* Ticker Selector for Quick Switching */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <span className="text-[10px] font-mono text-panel-subtext">Active Asset:</span>
          <select
            value={ticker}
            onChange={(e) => handleTickerChange(e.target.value)}
            className="bg-panel-inner-bg text-panel-heading border border-panel-border rounded px-2.5 py-1 text-xs font-mono font-bold focus:outline-none focus:border-indigo-500"
          >
            {tickers.map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        
        {/* Left Column: Parameter Configuration */}
        <div className="lg:col-span-4 bg-panel-inner-bg/40 border border-panel-border/60 rounded-xl p-4 space-y-4">
          <div className="flex items-center gap-1.5 border-b border-panel-border pb-2.5">
            <Sliders size={14} className="text-indigo-400" />
            <h4 className="text-xs font-bold text-panel-heading uppercase tracking-wide font-mono">
              Simulation Inputs
            </h4>
          </div>

          {/* Initial Capital */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-[11px]">
              <span className="text-panel-subtext">Starting Capital ($)</span>
              <span className="font-mono font-semibold text-panel-heading">${startingBalance.toLocaleString()}</span>
            </div>
            <input
              type="range"
              min="1000"
              max="100000"
              step="1000"
              value={startingBalance}
              onChange={(e) => setStartingBalance(Number(e.target.value))}
              className="w-full accent-indigo-500 bg-panel-border h-1 rounded cursor-pointer"
            />
          </div>

          {/* RSI Period */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-[11px]">
              <span className="text-panel-subtext">RSI Lookback Period</span>
              <span className="font-mono font-semibold text-panel-heading">{rsiPeriod} candles</span>
            </div>
            <input
              type="range"
              min="5"
              max="30"
              step="1"
              value={rsiPeriod}
              onChange={(e) => setRsiPeriod(Number(e.target.value))}
              className="w-full accent-indigo-500 bg-panel-border h-1 rounded cursor-pointer"
            />
          </div>

          {/* Overbought Trigger */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-[11px]">
              <span className="text-panel-subtext">RSI Overbought (Sell)</span>
              <span className="font-mono font-semibold text-rose-500 font-bold">{rsiOverbought}</span>
            </div>
            <input
              type="range"
              min="60"
              max="85"
              step="1"
              value={rsiOverbought}
              onChange={(e) => setRsiOverbought(Number(e.target.value))}
              className="w-full accent-rose-500 bg-panel-border h-1 rounded cursor-pointer"
            />
          </div>

          {/* Oversold Trigger */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-[11px]">
              <span className="text-panel-subtext">RSI Oversold (Buy)</span>
              <span className="font-mono font-semibold text-emerald-500 font-bold">{rsiOversold}</span>
            </div>
            <input
              type="range"
              min="15"
              max="40"
              step="1"
              value={rsiOversold}
              onChange={(e) => setRsiOversold(Number(e.target.value))}
              className="w-full accent-emerald-500 bg-panel-border h-1 rounded cursor-pointer"
            />
          </div>

          {/* Trigger Types */}
          <div className="grid grid-cols-2 gap-3.5 pt-1">
            <div className="space-y-1">
              <label className="text-[10px] text-panel-subtext font-semibold uppercase tracking-wide">Buy Trigger</label>
              <select
                value={entryTriggerType}
                onChange={(e) => setEntryTriggerType(e.target.value as any)}
                className="w-full bg-panel-bg text-panel-heading border border-panel-border rounded p-1.5 text-xs font-mono"
              >
                <option value="crossover">Cross UP Oversold</option>
                <option value="level">Under Oversold</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-panel-subtext font-semibold uppercase tracking-wide">Sell Trigger</label>
              <select
                value={exitTriggerType}
                onChange={(e) => setExitTriggerType(e.target.value as any)}
                className="w-full bg-panel-bg text-panel-heading border border-panel-border rounded p-1.5 text-xs font-mono"
              >
                <option value="crossover">Cross DOWN Overbought</option>
                <option value="level">Over Overbought</option>
              </select>
            </div>
          </div>

          {/* Trailing Stop Loss */}
          <div className="pt-2 border-t border-panel-border/55 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <input
                  type="checkbox"
                  id="enable-stop-loss"
                  checked={enableTrailingStop}
                  onChange={(e) => setEnableTrailingStop(e.target.checked)}
                  className="rounded text-indigo-600 bg-panel-inner-bg border-panel-border cursor-pointer h-3.5 w-3.5"
                />
                <label htmlFor="enable-stop-loss" className="text-[11px] font-medium text-panel-heading cursor-pointer">
                  Enable Trailing Stop Loss
                </label>
              </div>
              {enableTrailingStop && (
                <span className="font-mono text-xs text-rose-500 font-bold">{trailingStop}%</span>
              )}
            </div>

            {enableTrailingStop && (
              <input
                type="range"
                min="0.5"
                max="5.0"
                step="0.1"
                value={trailingStop}
                onChange={(e) => setTrailingStop(Number(e.target.value))}
                className="w-full accent-rose-500 bg-panel-border h-1 rounded cursor-pointer"
              />
            )}
          </div>

          <div className="p-2.5 bg-indigo-500/5 border border-indigo-500/10 rounded-lg flex gap-2">
            <Info size={14} className="text-indigo-400 shrink-0 mt-0.5" />
            <p className="text-[9.5px] text-panel-subtext leading-relaxed">
              <strong>Quick Tip:</strong> Combining a trailing stop with the crossover mode protects profit if a strong trend suddenly pulls back before hitting overbought.
            </p>
          </div>
        </div>

        {/* Right Column: Visual Dashboard */}
        <div className="lg:col-span-8 flex flex-col gap-4">
          
          {/* Metrics Row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            
            {/* End Balance Card */}
            <div className="p-3 bg-panel-inner-bg border border-panel-border rounded-xl space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-panel-subtext font-semibold uppercase tracking-wide">Ending Balance</span>
                <Coins size={12} className="text-indigo-400" />
              </div>
              <div className="text-sm font-black text-panel-heading font-mono">
                ${metrics.endingBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div className={`text-[10px] font-mono font-bold flex items-center gap-1 ${metrics.netProfit >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                <span>{metrics.netProfit >= 0 ? '▲' : '▼'}</span>
                <span>{metrics.netProfitPercent >= 0 ? '+' : ''}{metrics.netProfitPercent.toFixed(2)}%</span>
              </div>
            </div>

            {/* Win Rate Card */}
            <div className="p-3 bg-panel-inner-bg border border-panel-border rounded-xl space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-panel-subtext font-semibold uppercase tracking-wide">Win Rate</span>
                <Award size={12} className="text-emerald-400" />
              </div>
              <div className="text-sm font-black text-panel-heading font-mono">
                {metrics.winRate.toFixed(1)}%
              </div>
              <div className="text-[10px] text-panel-subtext font-mono">
                {metrics.winningTrades}W / {metrics.losingTrades}L
              </div>
            </div>

            {/* Profit Factor Card */}
            <div className="p-3 bg-panel-inner-bg border border-panel-border rounded-xl space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-panel-subtext font-semibold uppercase tracking-wide">Profit Factor</span>
                <TrendingUp size={12} className="text-indigo-400" />
              </div>
              <div className="text-sm font-black text-panel-heading font-mono">
                {metrics.profitFactor}
              </div>
              <div className="text-[10px]">
                <span className={`px-1.5 py-0.2 rounded text-[8px] font-black border font-mono ${profitFactorColor()}`}>
                  {metrics.profitFactor === 'Max (No Losses)' ? 'EXCELLENT' : parseFloat(metrics.profitFactor) >= 1.5 ? 'HEALTHY' : parseFloat(metrics.profitFactor) >= 1.0 ? 'BREAKEVEN' : 'UNPROFITABLE'}
                </span>
              </div>
            </div>

            {/* Max Drawdown Card */}
            <div className="p-3 bg-panel-inner-bg border border-panel-border rounded-xl space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-panel-subtext font-semibold uppercase tracking-wide">Max Drawdown</span>
                <ShieldAlert size={12} className="text-rose-400" />
              </div>
              <div className="text-sm font-black text-rose-500 font-mono">
                -{metrics.maxDrawdown.toFixed(2)}%
              </div>
              <div className="text-[10px] text-panel-subtext font-mono">
                vs Hold: {metrics.buyAndHoldProfitPercent >= 0 ? '+' : ''}{metrics.buyAndHoldProfitPercent.toFixed(1)}%
              </div>
            </div>
          </div>

          {/* Equity Curve Chart */}
          <div className="bg-panel-inner-bg border border-panel-border rounded-xl p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-panel-heading font-mono uppercase tracking-wide">Equity Curve Comparison</span>
              <div className="flex items-center gap-3.5 text-[9.5px]">
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2.5 bg-emerald-500 rounded-sm"></span>
                  <span className="text-panel-subtext">RSI Portfolio Equity</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-0.5 w-3 bg-panel-subtext/60 border-t border-dashed"></span>
                  <span className="text-panel-subtext">Buy & Hold Reference</span>
                </div>
              </div>
            </div>

            {/* Chart Area */}
            <div className="h-[210px] w-full text-xs">
              {candles.length < 5 ? (
                <div className="h-full flex flex-col items-center justify-center text-panel-subtext">
                  <AlertCircle size={20} className="mb-1 text-amber-500" />
                  <p className="text-[10px] font-mono">Insufficient candles to graph equity curve.</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={equityCurve} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.08)" />
                    <XAxis 
                      dataKey="time" 
                      stroke="#64748b" 
                      fontSize={8.5} 
                      tickLine={false} 
                      axisLine={false}
                      dy={4}
                    />
                    <YAxis 
                      stroke="#64748b" 
                      fontSize={8.5} 
                      tickLine={false} 
                      axisLine={false} 
                      domain={['auto', 'auto']}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0f172a',
                        borderColor: '#1e293b',
                        borderRadius: '8px',
                        fontSize: '11px',
                        color: '#f8fafc'
                      }}
                      labelStyle={{ color: '#94a3b8', fontFamily: 'monospace' }}
                    />
                    {/* Shaded Area for Portfolio Growth */}
                    <defs>
                      <linearGradient id="equityGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.15}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0.0}/>
                      </linearGradient>
                    </defs>
                    <Area 
                      type="monotone" 
                      dataKey="equity" 
                      stroke="#10b981" 
                      strokeWidth={1.8} 
                      fill="url(#equityGrad)" 
                      name="RSI Equity" 
                      dot={false}
                    />
                    {/* Buy and Hold Reference dashed line */}
                    <Line 
                      type="monotone" 
                      dataKey="buyAndHold" 
                      stroke="#94a3b8" 
                      strokeWidth={1.2} 
                      strokeDasharray="4 4"
                      name="Buy & Hold" 
                      dot={false} 
                      opacity={0.65}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Toggle Trades List Button */}
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setShowTradesTable(!showTradesTable)}
              className="flex items-center gap-1.5 text-[10.5px] font-bold font-mono text-panel-heading hover:text-indigo-400 transition cursor-pointer"
            >
              <FileText size={13} />
              <span>{showTradesTable ? 'Hide Backtest Ledger' : 'Show Backtest Ledger'} ({metrics.totalTrades} completed)</span>
              <ChevronDown size={12} className={`transform transition-transform ${showTradesTable ? 'rotate-180' : ''}`} />
            </button>
          </div>

          {/* Ledger Table */}
          {showTradesTable && (
            <div className="border border-panel-border rounded-xl bg-panel-inner-bg/25 overflow-hidden">
              {trades.length === 0 ? (
                <div className="p-7 text-center space-y-1">
                  <Calendar size={18} className="mx-auto text-panel-subtext opacity-50" />
                  <p className="text-[10.5px] font-mono text-panel-subtext font-semibold">No trades logged in simulation.</p>
                  <p className="text-[9px] text-panel-subtext/75 leading-relaxed">
                    Try lowering the "RSI Oversold" target or toggling "Under Oversold" mode to catch more dip points.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto max-h-[220px] scrollbar-thin">
                  <table className="w-full text-left border-collapse text-[10.5px] font-mono">
                    <thead>
                      <tr className="bg-panel-inner-bg/80 border-b border-panel-border text-[9.5px] text-panel-subtext uppercase font-black tracking-wider">
                        <th className="p-2 pl-3">ID</th>
                        <th className="p-2">In/Out Times</th>
                        <th className="p-2 text-right">Entry</th>
                        <th className="p-2 text-right">Exit</th>
                        <th className="p-2 text-right">Profit / Loss</th>
                        <th className="p-2 pr-3 text-right">Reason</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-panel-border/40">
                      {trades.map((tr) => {
                        const isWin = tr.profit > 0;
                        return (
                          <tr key={tr.id} className="hover:bg-panel-inner-bg/40 transition">
                            <td className="p-2 pl-3 text-panel-heading font-black">{tr.id}</td>
                            <td className="p-2">
                              <div className="flex flex-col">
                                <span className="text-panel-heading">{tr.entryTime}</span>
                                <span className="text-panel-subtext text-[9px]">→ {tr.exitTime}</span>
                              </div>
                            </td>
                            <td className="p-2 text-right text-panel-heading font-medium">
                              ${tr.entryPrice.toFixed(2)}
                            </td>
                            <td className="p-2 text-right text-panel-heading font-medium">
                              ${tr.exitPrice.toFixed(2)}
                            </td>
                            <td className="p-2 text-right">
                              <div className="flex flex-col items-end">
                                <span className={`font-extrabold flex items-center gap-0.5 ${isWin ? 'text-emerald-500' : 'text-rose-500'}`}>
                                  {isWin ? <CheckCircle size={9.5} className="inline" /> : <XCircle size={9.5} className="inline" />}
                                  {isWin ? '+' : ''}${tr.profit.toFixed(2)}
                                </span>
                                <span className={`text-[9px] font-bold ${isWin ? 'text-emerald-500/80' : 'text-rose-500/80'}`}>
                                  {isWin ? '+' : ''}{tr.profitPercent.toFixed(2)}%
                                </span>
                              </div>
                            </td>
                            <td className="p-2 pr-3 text-right text-panel-subtext text-[9px] font-semibold">
                              {tr.reason}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
