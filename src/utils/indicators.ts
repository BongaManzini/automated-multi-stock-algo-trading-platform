/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { OHLCV, Indicators, Candle } from '../types';

/**
 * Calculates Simple Moving Average (SMA)
 */
export function calculateSMA(prices: number[], period: number): (number | undefined)[] {
  const sma: (number | undefined)[] = [];
  for (let i = 0; i < prices.length; i++) {
    if (i < period - 1) {
      sma.push(undefined);
    } else {
      let sum = 0;
      for (let j = 0; j < period; j++) {
        sum += prices[i - j];
      }
      sma.push(Number((sum / period).toFixed(4)));
    }
  }
  return sma;
}

/**
 * Calculates Exponential Moving Average (EMA)
 */
export function calculateEMA(prices: number[], period: number): (number | undefined)[] {
  const ema: (number | undefined)[] = [];
  if (prices.length === 0) return [];

  const k = 2 / (period + 1);
  let prevEma = prices[0];
  ema.push(Number(prevEma.toFixed(4)));

  for (let i = 1; i < prices.length; i++) {
    const currentEma = prices[i] * k + prevEma * (1 - k);
    ema.push(Number(currentEma.toFixed(4)));
    prevEma = currentEma;
  }

  // To match typical implementation, we might nullify the first few values up to period-1
  for (let i = 0; i < Math.min(period - 1, prices.length); i++) {
    ema[i] = undefined;
  }
  return ema;
}

/**
 * Calculates Relative Strength Index (RSI)
 */
export function calculateRSI(prices: number[], period: number = 14): (number | undefined)[] {
  const rsi: (number | undefined)[] = [];
  if (prices.length <= period) {
    return Array(prices.length).fill(undefined);
  }

  const gains: number[] = [];
  const losses: number[] = [];

  // Calculate price changes
  for (let i = 1; i < prices.length; i++) {
    const change = prices[i] - prices[i - 1];
    gains.push(change > 0 ? change : 0);
    losses.push(change < 0 ? -change : 0);
  }

  // First averages
  let avgGain = 0;
  let avgLoss = 0;

  for (let i = 0; i < period; i++) {
    avgGain += gains[i];
    avgLoss += losses[i];
  }
  avgGain /= period;
  avgLoss /= period;

  // Insert undefineds for initial period
  for (let i = 0; i <= period; i++) {
    rsi.push(undefined);
  }

  let rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
  rsi[period] = Number((100 - 100 / (1 + rs)).toFixed(2));

  // Smoothed averages
  for (let i = period; i < gains.length; i++) {
    avgGain = (avgGain * (period - 1) + gains[i]) / period;
    avgLoss = (avgLoss * (period - 1) + losses[i]) / period;

    rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    rsi.push(Number((100 - 100 / (1 + rs)).toFixed(2)));
  }

  return rsi;
}

/**
 * Calculates Moving Average Convergence Divergence (MACD)
 */
export function calculateMACD(
  prices: number[],
  fastPeriod: number = 12,
  slowPeriod: number = 26,
  signalPeriod: number = 9
): ({ macdLine: number; signalLine: number; histogram: number } | undefined)[] {
  const macd: ({ macdLine: number; signalLine: number; histogram: number } | undefined)[] = [];

  if (prices.length < slowPeriod) {
    return Array(prices.length).fill(undefined);
  }

  const emaFast = calculateEMA(prices, fastPeriod);
  const emaSlow = calculateEMA(prices, slowPeriod);

  const macdLines: (number | undefined)[] = [];
  for (let i = 0; i < prices.length; i++) {
    const f = emaFast[i];
    const s = emaSlow[i];
    if (f !== undefined && s !== undefined) {
      macdLines.push(f - s);
    } else {
      macdLines.push(undefined);
    }
  }

  // Calculate signal line which is EMA(9) of the MACD line
  // To use calculateEMA, we must filter out undefined values and pad appropriately
  const validMacdStartIndex = macdLines.findIndex((v) => v !== undefined);
  const validMacdLines = macdLines.slice(validMacdStartIndex) as number[];
  const validSignalLines = calculateEMA(validMacdLines, signalPeriod);

  const signalLines: (number | undefined)[] = Array(validMacdStartIndex).fill(undefined).concat(validSignalLines);

  for (let i = 0; i < prices.length; i++) {
    const m = macdLines[i];
    const s = signalLines[i];
    if (m !== undefined && s !== undefined) {
      macd.push({
        macdLine: Number(m.toFixed(4)),
        signalLine: Number(s.toFixed(4)),
        histogram: Number((m - s).toFixed(4)),
      });
    } else {
      macd.push(undefined);
    }
  }

  return macd;
}

/**
 * Calculates Bollinger Bands (BB)
 */
export function calculateBollingerBands(
  prices: number[],
  period: number = 20,
  stdDevMultiplier: number = 2
): ({ upper: number; middle: number; lower: number } | undefined)[] {
  const bands: ({ upper: number; middle: number; lower: number } | undefined)[] = [];
  const sma = calculateSMA(prices, period);

  for (let i = 0; i < prices.length; i++) {
    const mid = sma[i];
    if (mid === undefined) {
      bands.push(undefined);
      continue;
    }

    // Calculate Standard Deviation
    let varianceSum = 0;
    for (let j = 0; j < period; j++) {
      varianceSum += Math.pow(prices[i - j] - mid, 2);
    }
    const stdDev = Math.sqrt(varianceSum / period);

    bands.push({
      upper: Number((mid + stdDevMultiplier * stdDev).toFixed(4)),
      middle: Number(mid.toFixed(4)),
      lower: Number((mid - stdDevMultiplier * stdDev).toFixed(4)),
    });
  }

  return bands;
}

/**
 * Calculates Stochastic Oscillator (%K, %D)
 */
export function calculateStochastic(
  candles: OHLCV[],
  kPeriod: number = 14,
  dPeriod: number = 3
): ({ k: number; d: number } | undefined)[] {
  const stochastic: ({ k: number; d: number } | undefined)[] = [];
  if (candles.length < kPeriod) {
    return Array(candles.length).fill(undefined);
  }

  const kValues: (number | undefined)[] = [];

  for (let i = 0; i < candles.length; i++) {
    if (i < kPeriod - 1) {
      kValues.push(undefined);
      stochastic.push(undefined);
      continue;
    }

    // Get lowest low and highest high over the kPeriod
    let lowestLow = Infinity;
    let highestHigh = -Infinity;
    for (let j = 0; j < kPeriod; j++) {
      const c = candles[i - j];
      if (c.low < lowestLow) lowestLow = c.low;
      if (c.high > highestHigh) highestHigh = c.high;
    }

    const currentClose = candles[i].close;
    const denominator = highestHigh - lowestLow;
    const k = denominator === 0 ? 50 : ((currentClose - lowestLow) / denominator) * 100;
    kValues.push(Number(k.toFixed(2)));

    // Calculate SMA of %K for %D
    let kSum = 0;
    let kCount = 0;
    for (let j = 0; j < dPeriod; j++) {
      const val = kValues[i - j];
      if (val !== undefined) {
        kSum += val;
        kCount++;
      }
    }

    if (kCount === dPeriod) {
      stochastic.push({
        k: Number(k.toFixed(2)),
        d: Number((kSum / dPeriod).toFixed(2))
      });
    } else {
      stochastic.push(undefined);
    }
  }

  return stochastic;
}

/**
 * Calculates Average True Range (ATR)
 */
export function calculateATR(
  candles: OHLCV[],
  period: number = 14
): (number | undefined)[] {
  const atr: (number | undefined)[] = [];
  if (candles.length === 0) return [];

  const trs: number[] = [candles[0].high - candles[0].low];

  for (let i = 1; i < candles.length; i++) {
    const high = candles[i].high;
    const low = candles[i].low;
    const prevClose = candles[i - 1].close;

    const tr = Math.max(
      high - low,
      Math.abs(high - prevClose),
      Math.abs(low - prevClose)
    );
    trs.push(tr);
  }

  let sum = 0;
  for (let i = 0; i < Math.min(period, trs.length); i++) {
    sum += trs[i];
    atr.push(undefined);
  }

  if (trs.length >= period) {
    let currentAtr = sum / period;
    atr[period - 1] = Number(currentAtr.toFixed(4));

    for (let i = period; i < trs.length; i++) {
      currentAtr = (currentAtr * (period - 1) + trs[i]) / period;
      atr.push(Number(currentAtr.toFixed(4)));
    }
  } else {
    for (let i = trs.length; i < candles.length; i++) {
      atr.push(undefined);
    }
  }

  return atr;
}

/**
 * Calculates Heikin-Ashi Candlesticks
 */
export function calculateHeikinAshi(candles: OHLCV[]): { haOpen: number; haHigh: number; haLow: number; haClose: number }[] {
  if (candles.length === 0) return [];
  const result: { haOpen: number; haHigh: number; haLow: number; haClose: number }[] = [];

  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];
    const haClose = Number(((c.open + c.high + c.low + c.close) / 4).toFixed(4));
    let haOpen: number;
    if (i === 0) {
      haOpen = Number(((c.open + c.close) / 2).toFixed(4));
    } else {
      haOpen = Number(((result[i - 1].haOpen + result[i - 1].haClose) / 2).toFixed(4));
    }
    const haHigh = Number(Math.max(c.high, haOpen, haClose).toFixed(4));
    const haLow = Number(Math.min(c.low, haOpen, haClose).toFixed(4));

    result.push({ haOpen, haHigh, haLow, haClose });
  }

  return result;
}

/**
 * Computes all indicators for a list of OHLCV candles
 */
export function computeAllIndicators(
  candles: OHLCV[],
  config: {
    smaShortPeriod: number;
    smaLongPeriod: number;
    macdFastPeriod: number;
    macdSlowPeriod: number;
    macdSignalPeriod: number;
    rsiPeriod: number;
  }
): Candle[] {
  const prices = candles.map((c) => c.close);
  const smaShort = calculateSMA(prices, config.smaShortPeriod);
  const smaLong = calculateSMA(prices, config.smaLongPeriod);
  const ema = calculateEMA(prices, config.smaShortPeriod); // Use short period for EMA
  const rsi = calculateRSI(prices, config.rsiPeriod);
  const macd = calculateMACD(prices, config.macdFastPeriod, config.macdSlowPeriod, config.macdSignalPeriod);
  const bbands = calculateBollingerBands(prices, 20, 2);
  const stochastic = calculateStochastic(candles, 14, 3);
  const atr = calculateATR(candles, 14);
  const ha = calculateHeikinAshi(candles);

  return candles.map((candle, i) => {
    const indicators: Indicators = {};
    if (smaShort[i] !== undefined) indicators.smaShort = smaShort[i];
    if (smaLong[i] !== undefined) indicators.smaLong = smaLong[i];
    if (ema[i] !== undefined) indicators.ema = ema[i];
    if (rsi[i] !== undefined) indicators.rsi = rsi[i];
    if (macd[i] !== undefined) indicators.macd = macd[i];
    if (bbands[i] !== undefined) indicators.bollingerBands = bbands[i];
    if (stochastic[i] !== undefined) indicators.stochastic = stochastic[i];
    if (atr[i] !== undefined) indicators.atr = atr[i];

    const haVals = ha[i] || { haOpen: candle.open, haHigh: candle.high, haLow: candle.low, haClose: candle.close };

    return {
      ...candle,
      haOpen: haVals.haOpen,
      haHigh: haVals.haHigh,
      haLow: haVals.haLow,
      haClose: haVals.haClose,
      indicators,
    };
  });
}
