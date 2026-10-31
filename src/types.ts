/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface OHLCV {
  time: string; // ISO string or simple time format
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  haOpen?: number;
  haHigh?: number;
  haLow?: number;
  haClose?: number;
}

export interface Indicators {
  smaShort?: number;
  smaLong?: number;
  ema?: number;
  rsi?: number;
  macd?: {
    macdLine: number;
    signalLine: number;
    histogram: number;
  };
  bollingerBands?: {
    upper: number;
    middle: number;
    lower: number;
  };
  stochastic?: {
    k: number;
    d: number;
  };
  atr?: number;
}

export interface Candle extends OHLCV {
  indicators: Indicators;
  signal?: 'BUY' | 'SELL' | 'HOLD';
}

export interface StrategyParameters {
  rsiOverbought: number;
  rsiOversold: number;
  smaShortPeriod: number;
  smaLongPeriod: number;
  macdFastPeriod: number;
  macdSlowPeriod: number;
  macdSignalPeriod: number;
  trailingStopPercent: number; // e.g., 2%
  riskRewardRatio?: number; // e.g. 2.0 (1:2 risk:reward)
  stopLossPercent?: number; // e.g. 1.5%
  takeProfitPercent?: number; // e.g. 3.0%
  infinitronPivotPeriod?: number; // e.g. 4
  useSmaCross?: boolean;
  useRsiBreach?: boolean;
  useMacdCross?: boolean;
  usePivotTrigger?: boolean;
}

export interface Strategy {
  id: string;
  name: string;
  description: string;
  parameters: StrategyParameters;
}

export type ChartMode = 'candlestick' | 'line' | 'area' | 'bar' | 'heikin-ashi';
export type WorkspaceMode = 'single' | 'matrix';
export type TimeframeMode = '1m' | '5m' | '15m' | '1h' | '1d';

export interface BacktestMetrics {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number; // e.g., 68.5%
  totalPnL: number; // e.g., $1450.20
  sharpeRatio: number; // e.g., 1.85
  maxDrawdownPercent: number; // e.g., 4.2%
  profitFactor: number; // e.g., 2.1
  avgTradeDurationMin: number; // e.g., 25 mins
  equityCurve: { time: string; equity: number }[];
}

export interface CrosshairState {
  enabled: boolean;
  label: string | null;
  yPercent: number | null;
}

export type OrderType = 'MARKET' | 'LIMIT';
export type OrderSide = 'BUY' | 'SELL';
export type OrderStatus = 'PENDING' | 'FILLED' | 'REJECTED' | 'CANCELLED';

export interface Order {
  id: string;
  ticker: string;
  side: OrderSide;
  type: OrderType;
  price: number;
  quantity: number;
  amount: number;
  status: OrderStatus;
  timestamp: string;
  is_live: boolean;
  notes?: string;
  execution_latency_ms: number;
}

export interface Position {
  ticker: string;
  quantity: number;
  averagePrice: number;
  currentPrice: number;
  unrealizedPnL: number;
  trailingStopPrice: number | null;
  liquidationPrice?: number;
  is_live: boolean;
}

export interface Portfolio {
  cash: number;
  initialBalance: number;
  realizedPnL: number;
  is_live: boolean;
}

export interface BrokerConfig {
  provider: 'alpaca' | 'ibkr' | 'ccxt';
  apiKey: string;
  apiSecret: string;
  isLive: boolean;
  baseUrl: string;
}

export interface AgentLog {
  id: string;
  agent: 'DATA_INDICATOR' | 'RISK_PORTFOLIO' | 'EXECUTION_BROKER' | 'CANDY_SAVER' | 'TREND_BOOSTER' | 'MASTER_CHIEF';
  type: 'INFO' | 'WARNING' | 'SUCCESS' | 'TRADE';
  message: string;
  timestamp: string;
}

