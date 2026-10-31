/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Candle, OHLCV, Strategy, StrategyParameters, Order, Position, Portfolio, OrderSide } from '../types';
import { computeAllIndicators } from './indicators';

export const TICKER_INFO: Record<string, { name: string; initPrice: number; volatility: number }> = {
  AAPL: { name: 'Apple Inc.', initPrice: 175.50, volatility: 0.0015 },
  MSFT: { name: 'Microsoft Corp.', initPrice: 415.20, volatility: 0.0012 },
  TSLA: { name: 'Tesla Inc.', initPrice: 185.10, volatility: 0.0035 },
  NVDA: { name: 'NVIDIA Corp.', initPrice: 875.40, volatility: 0.0040 },
  BTC_USD: { name: 'Bitcoin / USD', initPrice: 65200.00, volatility: 0.0060 },
};

/**
 * Generates seed data for a given stock ticker
 */
export function generateSeedData(ticker: string, count: number = 80, timeframe: string = '5m'): OHLCV[] {
  const info = TICKER_INFO[ticker] || { name: 'Stock', initPrice: 100, volatility: 0.002 };
  const data: OHLCV[] = [];
  let currentPrice = info.initPrice;
  const now = new Date();

  // Get timeframe interval in minutes
  let tfMinutes = 5;
  if (timeframe === '1m') tfMinutes = 1;
  else if (timeframe === '5m') tfMinutes = 5;
  else if (timeframe === '15m') tfMinutes = 15;
  else if (timeframe === '1h') tfMinutes = 60;
  else if (timeframe === '1d') tfMinutes = 1440;

  // Create historical timestamps
  for (let i = count - 1; i >= 0; i--) {
    const time = new Date(now.getTime() - i * tfMinutes * 60 * 1000);
    const changePercent = (Math.random() - 0.495) * info.volatility * 4; // slight upward drift
    const open = Number((currentPrice * (1 + changePercent * 0.2)).toFixed(2));
    const close = Number((currentPrice * (1 + changePercent)).toFixed(2));
    const high = Number((Math.max(open, close) * (1 + Math.random() * info.volatility)).toFixed(2));
    const low = Number((Math.min(open, close) * (1 - Math.random() * info.volatility)).toFixed(2));
    const volume = Math.floor(Math.random() * 50000) + 10000;

    let timeString = '';
    if (timeframe === '1d') {
      timeString = time.toLocaleDateString([], { month: 'short', day: 'numeric' });
    } else if (timeframe === '1h') {
      timeString = time.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    } else if (timeframe === '15m' || timeframe === '5m') {
      timeString = time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else {
      timeString = time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }

    data.push({
      time: timeString,
      open,
      high,
      low,
      close,
      volume,
    });
    currentPrice = close;
  }
  return data;
}

/**
 * Simulates a new high-fidelity tick and appends a new candle based on Brownian motion
 */
export function generateNextCandle(ticker: string, lastCandle: Candle, timeframe: string = '5m'): OHLCV {
  const info = TICKER_INFO[ticker] || { name: 'Stock', initPrice: 100, volatility: 0.002 };
  const changePercent = (Math.random() - 0.49) * info.volatility * 5; // tiny drift
  const open = lastCandle.close;
  const close = Number((open * (1 + changePercent)).toFixed(2));
  const high = Number((Math.max(open, close) * (1 + Math.random() * info.volatility)).toFixed(2));
  const low = Number((Math.min(open, close) * (1 - Math.random() * info.volatility)).toFixed(2));
  const volume = Math.floor(Math.random() * 30000) + 5000;

  // Formulate a sequential time following the timeframe
  const now = new Date();
  let timeString = '';
  if (timeframe === '1d') {
    timeString = now.toLocaleDateString([], { month: 'short', day: 'numeric' }) + " " + now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } else if (timeframe === '1h') {
    timeString = now.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } else if (timeframe === '15m' || timeframe === '5m') {
    timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } else {
    timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  return {
    time: timeString,
    open,
    high,
    low,
    close,
    volume,
  };
}

/**
 * [Data & Indicator Agent] - Evaluate technical rules and determine indicators state-based signals
 */
export function evaluateSignals(candles: Candle[], strategy: Strategy): 'BUY' | 'SELL' | 'HOLD' {
  if (candles.length < 3) return 'HOLD';
  
  const current = candles[candles.length - 1];
  const previous = candles[candles.length - 2];
  
  const params: StrategyParameters = strategy.parameters || ({} as StrategyParameters);
  const rsiOverbought = params.rsiOverbought ?? 70;
  const rsiOversold = params.rsiOversold ?? 30;
  const useSmaCross = params.useSmaCross ?? true;
  const useRsiBreach = params.useRsiBreach ?? true;
  const useMacdCross = params.useMacdCross ?? true;
  const usePivotTrigger = params.usePivotTrigger ?? true;

  const currentRsi = current.indicators.rsi;
  const prevRsi = previous.indicators.rsi;

  const currentSmaShort = current.indicators.smaShort;
  const currentSmaLong = current.indicators.smaLong;
  const prevSmaShort = previous.indicators.smaShort;
  const prevSmaLong = previous.indicators.smaLong;

  const currentMacd = current.indicators.macd;
  const prevMacd = previous.indicators.macd;

  let buySignals = 0;
  let sellSignals = 0;
  let conditionsEvaluated = 0;

  // Rule 1: RSI Overbought/Oversold Crossovers
  if (useRsiBreach && currentRsi !== undefined && prevRsi !== undefined) {
    conditionsEvaluated++;
    // Crosses up from oversold -> Strong Buy
    if (prevRsi <= rsiOversold && currentRsi > rsiOversold) {
      buySignals += 2;
    }
    // Crosses down from overbought -> Strong Sell
    else if (prevRsi >= rsiOverbought && currentRsi < rsiOverbought) {
      sellSignals += 2;
    }
    // Deeply overbought
    else if (currentRsi >= rsiOverbought) {
      sellSignals++;
    }
    // Deeply oversold
    else if (currentRsi <= rsiOversold) {
      buySignals++;
    }
  }

  // Rule 2: SMA Golden Cross / Death Cross
  if (useSmaCross && currentSmaShort !== undefined && currentSmaLong !== undefined && prevSmaShort !== undefined && prevSmaLong !== undefined) {
    conditionsEvaluated++;
    // Golden Cross: Short-term MA crosses above Long-term MA
    if (prevSmaShort <= prevSmaLong && currentSmaShort > currentSmaLong) {
      buySignals += 2;
    }
    // Death Cross: Short-term MA crosses below Long-term MA
    else if (prevSmaShort >= prevSmaLong && currentSmaShort < currentSmaLong) {
      sellSignals += 2;
    }
  }

  // Rule 3: MACD Crossovers (Histogram change and lines crossing)
  if (useMacdCross && currentMacd !== undefined && prevMacd !== undefined) {
    conditionsEvaluated++;
    // MACD Line crosses above Signal Line (Bullish)
    if (prevMacd.macdLine <= prevMacd.signalLine && currentMacd.macdLine > currentMacd.signalLine) {
      buySignals += 1.5;
    }
    // MACD Line crosses below Signal Line (Bearish)
    else if (prevMacd.macdLine >= prevMacd.signalLine && currentMacd.macdLine < currentMacd.signalLine) {
      sellSignals += 1.5;
    }
  }

  // Rule 4: Pivot Breakout / Reversal Triggers
  if (usePivotTrigger && candles.length >= 10) {
    conditionsEvaluated++;
    const recentLow = Math.min(...candles.slice(-10, -1).map(c => c.low));
    const recentHigh = Math.max(...candles.slice(-10, -1).map(c => c.high));
    if (current.close > recentHigh) {
      buySignals += 1.5;
    } else if (current.close < recentLow) {
      sellSignals += 1.5;
    }
  }

  const threshold = Math.max(1, conditionsEvaluated * 0.6);

  if (buySignals >= threshold && buySignals > sellSignals) {
    return 'BUY';
  } else if (sellSignals >= threshold && sellSignals > buySignals) {
    return 'SELL';
  }

  return 'HOLD';
}

/**
 * Executes historical backtest simulation and computes quantitative performance metrics
 */
export function runBacktestSimulation(
  candles: Candle[],
  strategy: Strategy,
  initialCapital: number = 10000
) {
  if (!candles || candles.length < 15) {
    return {
      totalTrades: 0,
      winningTrades: 0,
      losingTrades: 0,
      winRate: 0,
      totalPnL: 0,
      sharpeRatio: 0,
      maxDrawdownPercent: 0,
      profitFactor: 0,
      avgTradeDurationMin: 0,
      equityCurve: []
    };
  }

  let cash = initialCapital;
  let positionQty = 0;
  let entryPrice = 0;
  let entryTime: Date | null = null;
  const tradeHistory: { pnl: number; durationMin: number; isWin: boolean }[] = [];
  const equityCurve: { time: string; equity: number }[] = [];
  let peakEquity = initialCapital;
  let maxDrawdown = 0;

  for (let i = 15; i < candles.length; i++) {
    const subHistory = candles.slice(0, i + 1);
    const current = candles[i];
    const signal = evaluateSignals(subHistory, strategy);
    const currentEquity = cash + positionQty * current.close;

    if (currentEquity > peakEquity) {
      peakEquity = currentEquity;
    }
    const currentDrawdown = ((peakEquity - currentEquity) / peakEquity) * 100;
    if (currentDrawdown > maxDrawdown) {
      maxDrawdown = currentDrawdown;
    }

    equityCurve.push({
      time: current.time,
      equity: Number(currentEquity.toFixed(2))
    });

    // Execute trade logic
    if (signal === 'BUY' && positionQty === 0) {
      // Enter Long Position using 95% of cash
      const amountToInvest = cash * 0.95;
      positionQty = amountToInvest / current.close;
      cash -= amountToInvest;
      entryPrice = current.close;
      entryTime = new Date(current.time);
    } else if (signal === 'SELL' && positionQty > 0) {
      // Close Long Position
      const proceed = positionQty * current.close;
      const pnl = proceed - (positionQty * entryPrice);
      cash += proceed;
      
      const exitTime = new Date(current.time);
      const durationMin = entryTime ? Math.max(1, Math.round((exitTime.getTime() - entryTime.getTime()) / (1000 * 60))) : 5;

      tradeHistory.push({
        pnl,
        durationMin,
        isWin: pnl > 0
      });

      positionQty = 0;
      entryPrice = 0;
      entryTime = null;
    }
  }

  // Close open position at end of backtest if still open
  if (positionQty > 0) {
    const lastPrice = candles[candles.length - 1].close;
    const proceed = positionQty * lastPrice;
    const pnl = proceed - (positionQty * entryPrice);
    cash += proceed;
    tradeHistory.push({
      pnl,
      durationMin: 15,
      isWin: pnl > 0
    });
  }

  const finalEquity = cash;
  const totalPnL = Number((finalEquity - initialCapital).toFixed(2));
  const winningTrades = tradeHistory.filter((t) => t.isWin).length;
  const losingTrades = tradeHistory.length - winningTrades;
  const winRate = tradeHistory.length > 0 ? Number(((winningTrades / tradeHistory.length) * 100).toFixed(1)) : 0;

  const grossProfit = tradeHistory.filter(t => t.pnl > 0).reduce((acc, t) => acc + t.pnl, 0);
  const grossLoss = Math.abs(tradeHistory.filter(t => t.pnl < 0).reduce((acc, t) => acc + t.pnl, 0));
  const profitFactor = grossLoss > 0 ? Number((grossProfit / grossLoss).toFixed(2)) : (grossProfit > 0 ? 9.99 : 0);

  const returns = tradeHistory.map(t => t.pnl);
  const avgReturn = returns.length > 0 ? returns.reduce((a, b) => a + b, 0) / returns.length : 0;
  const stdDevReturn = returns.length > 1 
    ? Math.sqrt(returns.reduce((sq, n) => sq + Math.pow(n - avgReturn, 2), 0) / (returns.length - 1))
    : 1;
  const sharpeRatio = stdDevReturn > 0 ? Number(((avgReturn / stdDevReturn) * Math.sqrt(252)).toFixed(2)) : 0;

  const avgTradeDurationMin = tradeHistory.length > 0
    ? Math.round(tradeHistory.reduce((acc, t) => acc + t.durationMin, 0) / tradeHistory.length)
    : 0;

  return {
    totalTrades: tradeHistory.length,
    winningTrades,
    losingTrades,
    winRate,
    totalPnL,
    sharpeRatio,
    maxDrawdownPercent: Number(maxDrawdown.toFixed(2)),
    profitFactor,
    avgTradeDurationMin,
    equityCurve
  };
}

/**
 * [Risk & Portfolio Agent] - Evaluates risk bounds, manages positions, calculates floating stop losses
 */
export function processRiskAndTrailingStops(
  positions: Position[],
  currentPrices: Record<string, number>,
  trailingStopPercent: number,
  onTriggerStop: (ticker: string, price: number) => void
): Position[] {
  return positions.map((pos) => {
    const currentPrice = currentPrices[pos.ticker];
    if (currentPrice === undefined) return pos;

    const unrealizedPnL = (currentPrice - pos.averagePrice) * pos.quantity;
    const liquidationPrice = Number((pos.averagePrice * 0.85).toFixed(2)); // 15% drop liquidation baseline
    
    // Trailing Stop calculations
    let trailingStopPrice = pos.trailingStopPrice;
    let triggered = false;

    if (trailingStopPrice !== null) {
      // If price moves in our favor, slide the trailing stop price upwards
      const potentialNewStop = currentPrice * (1 - trailingStopPercent / 100);
      if (potentialNewStop > trailingStopPrice) {
        trailingStopPrice = Number(potentialNewStop.toFixed(2));
      }
      
      // Check trigger condition
      if (currentPrice <= trailingStopPrice) {
        triggered = true;
      }
    } else {
      // Initialize trailing stop
      trailingStopPrice = Number((currentPrice * (1 - trailingStopPercent / 100)).toFixed(2));
    }

    if (triggered) {
      // Trigger stop execution async
      setTimeout(() => onTriggerStop(pos.ticker, currentPrice), 10);
    }

    return {
      ...pos,
      currentPrice,
      unrealizedPnL: Number(unrealizedPnL.toFixed(2)),
      liquidationPrice,
      trailingStopPrice: triggered ? null : trailingStopPrice,
    };
  });
}
