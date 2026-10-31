import React from 'react';
import { Candle } from '../types';

export interface PivotLevel {
  id: string;
  type: 'high' | 'low';
  price: number;
  startIndex: number;
  endIndex: number;
}

/**
 * Calculates swing high/low Pivot S&R Levels ("Infinitron")
 */
export function calculateInfinitronLevels(fullCandles: Candle[], period: number = 4): PivotLevel[] {
  const levels: PivotLevel[] = [];
  if (fullCandles.length < period * 2 + 1) return [];

  for (let i = period; i < fullCandles.length - period; i++) {
    const currentHigh = fullCandles[i].high;
    const currentLow = fullCandles[i].low;

    // Check Pivot High
    let isHigh = true;
    for (let j = i - period; j <= i + period; j++) {
      if (j === i) continue;
      if (fullCandles[j].high > currentHigh) {
        isHigh = false;
        break;
      }
      if (fullCandles[j].high === currentHigh && j < i) {
        isHigh = false;
        break;
      }
    }

    // Check Pivot Low
    let isLow = true;
    for (let j = i - period; j <= i + period; j++) {
      if (j === i) continue;
      if (fullCandles[j].low < currentLow) {
        isLow = false;
        break;
      }
      if (fullCandles[j].low === currentLow && j < i) {
        isLow = false;
        break;
      }
    }

    if (isHigh) {
      // Find where it ends: either broken by a future close, or max duration (e.g., 35 candles)
      let endIndex = Math.min(fullCandles.length - 1, i + 35);
      for (let k = i + 1; k <= endIndex; k++) {
        if (fullCandles[k].close > currentHigh) {
          endIndex = k;
          break;
        }
      }
      levels.push({
        id: `high-${i}-${currentHigh}`,
        type: 'high',
        price: currentHigh,
        startIndex: i,
        endIndex
      });
    }

    if (isLow) {
      // Find where it ends: either broken by a future close, or max duration (e.g., 35 candles)
      let endIndex = Math.min(fullCandles.length - 1, i + 35);
      for (let k = i + 1; k <= endIndex; k++) {
        if (fullCandles[k].close < currentLow) {
          endIndex = k;
          break;
        }
      }
      levels.push({
        id: `low-${i}-${currentLow}`,
        type: 'low',
        price: currentLow,
        startIndex: i,
        endIndex
      });
    }
  }

  return levels;
}

interface InfinitronPivotsOverlayProps {
  fullCandles: Candle[];
  visibleCandles: Candle[];
  show: boolean;
  pivotPeriod?: number;
  xAxis?: any;
  yAxis?: any;
}

export function InfinitronPivotsOverlay({
  fullCandles,
  visibleCandles,
  show,
  pivotPeriod = 4,
  xAxis,
  yAxis
}: InfinitronPivotsOverlayProps) {
  if (!show || !fullCandles || fullCandles.length === 0 || !visibleCandles || visibleCandles.length === 0) {
    return null;
  }

  // Calculate the pivot levels based on the full data series
  const levels = calculateInfinitronLevels(fullCandles, pivotPeriod);

  // Retrieve Recharts scales defensively
  const scaleY = (val: number) => {
    if (yAxis && typeof yAxis.scale === 'function') {
      return yAxis.scale(val);
    }
    const domain = yAxis?.domain || [100, 200];
    const [min, max] = domain;
    const height = yAxis?.height || 240;
    const yVal = yAxis?.y || 15;
    const range = max - min;
    if (range === 0) return yVal + height / 2;
    const pct = (val - min) / range;
    return yVal + height - pct * height;
  };

  const scaleX = (time: string) => {
    if (xAxis && typeof xAxis.scale === 'function') {
      const xVal = xAxis.scale(time);
      const halfBand = xAxis.scale.bandwidth ? xAxis.scale.bandwidth() / 2 : 0;
      return xVal + halfBand;
    }
    return 0;
  };

  // Map visible times for index lookup
  const visibleTimesMap = new Map<string, number>();
  visibleCandles.forEach((c, idx) => {
    visibleTimesMap.set(c.time, idx);
  });

  // Calculate Floor Pivots from visible range
  const visibleHigh = Math.max(...visibleCandles.map(c => c.high));
  const visibleLow = Math.min(...visibleCandles.map(c => c.low));
  const visibleClose = visibleCandles[visibleCandles.length - 1].close;

  const floorP = (visibleHigh + visibleLow + visibleClose) / 3;
  const floorR1 = 2 * floorP - visibleLow;
  const floorS1 = 2 * floorP - visibleHigh;
  const floorR2 = floorP + (visibleHigh - visibleLow);
  const floorS2 = floorP - (visibleHigh - visibleLow);

  const fib236 = visibleLow + (visibleHigh - visibleLow) * 0.236;
  const fib382 = visibleLow + (visibleHigh - visibleLow) * 0.382;
  const fib500 = visibleLow + (visibleHigh - visibleLow) * 0.500;
  const fib618 = visibleLow + (visibleHigh - visibleLow) * 0.618;
  const fib786 = visibleLow + (visibleHigh - visibleLow) * 0.786;

  const width = xAxis?.width || 800;

  return (
    <g id="infinitron-pivots-layer">
      {/* Dynamic Floor Pivots overlay */}
      {[
        { label: 'Pivot (P)', price: floorP, color: '#eab308' },
        { label: 'Resistance R1', price: floorR1, color: '#f43f5e' },
        { label: 'Resistance R2', price: floorR2, color: '#e11d48' },
        { label: 'Support S1', price: floorS1, color: '#10b981' },
        { label: 'Support S2', price: floorS2, color: '#059669' },
        { label: 'Fib 61.8%', price: fib618, color: '#a855f7' },
        { label: 'Fib 38.2%', price: fib382, color: '#38bdf8' }
      ].map((fp) => {
        const y = scaleY(fp.price);
        return (
          <g key={fp.label}>
            <line x1={0} y1={y} x2={width} y2={y} stroke={fp.color} strokeWidth={1} strokeDasharray="4 4" strokeOpacity={0.6} />
            <text x={width - 5} y={y - 3} fill={fp.color} fontSize={9} textAnchor="end" fontFamily="monospace">
              {fp.label}: ${fp.price.toFixed(2)}
            </text>
          </g>
        );
      })}

      {levels.map((level) => {
        let firstVisibleIdx: number | null = null;
        let lastVisibleIdx: number | null = null;

        for (let idx = level.startIndex; idx <= level.endIndex; idx++) {
          const candle = fullCandles[idx];
          if (!candle) continue;
          const vIdx = visibleTimesMap.get(candle.time);
          if (vIdx !== undefined) {
            if (firstVisibleIdx === null) {
              firstVisibleIdx = vIdx;
            }
            lastVisibleIdx = vIdx;
          }
        }

        if (firstVisibleIdx === null || lastVisibleIdx === null) {
          return null;
        }

        const x1 = scaleX(visibleCandles[firstVisibleIdx].time);
        const x2 = scaleX(visibleCandles[lastVisibleIdx].time);
        const y = scaleY(level.price);

        const isHigh = level.type === 'high';
        // Pink/magenta for high (resistance), deep sky blue for low (support)
        const strokeColor = isHigh ? '#f43f5e' : '#38bdf8'; 
        const strokeGlow = isHigh ? '#fda4af' : '#bae6fd';

        return (
          <g key={level.id}>
            {/* Soft background glow line */}
            <line
              x1={x1}
              y1={y}
              x2={x2}
              y2={y}
              stroke={strokeGlow}
              strokeWidth={5}
              strokeOpacity={0.15}
            />
            {/* Core support / resistance level line */}
            <line
              x1={x1}
              y1={y}
              x2={x2}
              y2={y}
              stroke={strokeColor}
              strokeWidth={2.2}
              strokeOpacity={0.85}
              strokeDasharray={isHigh ? undefined : "5 2"}
            />
            {/* Level label on hover / tiny start node */}
            <circle
              cx={x1}
              cy={y}
              r={2.5}
              fill={strokeColor}
            />
          </g>
        );
      })}
    </g>
  );
}
