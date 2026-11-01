/**
 * @license
 * SPDX-License-Identifier: Apache-2.5
 */

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  TrendingUp, 
  Play, 
  Pause, 
  AlertOctagon, 
  Activity, 
  History, 
  Briefcase, 
  RefreshCw, 
  ArrowUpRight, 
  ArrowDownRight,
  ChevronRight,
  ShieldAlert,
  Info,
  Bell,
  BellRing,
  AlertTriangle,
  Cpu,
  Layers,
  Settings,
  Check,
  Trash2,
  HelpCircle,
  TrendingDown,
  Sun,
  Moon,
  X,
  Plus,
  Minus,
  LayoutGrid,
  Grid,
  Sliders,
  Award,
  Crosshair
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  ComposedChart, 
  Line, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid, 
  Bar, 
  ReferenceLine,
  Scatter,
  Area,
  Cell
} from 'recharts';

import { Candle, Strategy, Order, Position, Portfolio, BrokerConfig, AgentLog, OHLCV } from './types';
import { computeAllIndicators } from './utils/indicators';
import { generateSeedData, generateNextCandle, evaluateSignals, processRiskAndTrailingStops, TICKER_INFO } from './utils/simulation';

import StrategyBuilder from './components/StrategyBuilder';
import StrategyBacktester from './components/StrategyBacktester';
import SidebarNavigator from './components/SidebarNavigator';
import { InfinitronPivotsOverlay } from './components/InfinitronPivotsOverlay';
import GlobalSidebar from './components/GlobalSidebar';
import StackedOscillators from './components/StackedOscillators';
import MultiChartMatrix from './components/MultiChartMatrix';
import ExecutionBlotter from './components/ExecutionBlotter';
import { FeatureGuideModal } from './components/FeatureGuideModal';

// Firebase Integrations
import { auth } from './lib/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { 
  loadUserTerminalData, 
  savePortfolioState, 
  saveActiveStrategy, 
  saveBrokerConfig, 
  saveOrderRecord, 
  saveAlertRecord, 
  deleteAlertRecord, 
  syncAllAlerts, 
  saveAuditLogs 
} from './lib/firebaseSync';
import AuthScreen from './components/AuthScreen';

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

export interface PriceAlert {
  id: string;
  ticker: string;
  price: number;
  changePercent: number;
  direction: 'GROWTH' | 'LOSS';
  timestamp: string;
  acknowledged: boolean;
}

// Custom shape renderer for Candlestick / Heikin-Ashi charts in Recharts
function Candlestick(props: any) {
  const { x, width, open, close, high, low, yAxis, payload, isHeikinAshi } = props;
  
  // Extract values, looking inside the payload as fallback (useful when used as a React element in shape)
  const o = isHeikinAshi ? (payload?.haOpen ?? open ?? payload?.open) : (open ?? payload?.open);
  const c = isHeikinAshi ? (payload?.haClose ?? close ?? payload?.close) : (close ?? payload?.close);
  const h = isHeikinAshi ? (payload?.haHigh ?? high ?? payload?.high) : (high ?? payload?.high);
  const l = isHeikinAshi ? (payload?.haLow ?? low ?? payload?.low) : (low ?? payload?.low);

  if (o === undefined || c === undefined || h === undefined || l === undefined) {
    return null;
  }

  const cleanX = x ?? 0;
  const cleanW = width ?? 10;

  let scale: (val: number) => number;
  if (yAxis && typeof yAxis.scale === 'function') {
    scale = yAxis.scale;
  } else if (yAxis && yAxis.domain && typeof yAxis.height === 'number' && typeof yAxis.y === 'number') {
    const [min, max] = yAxis.domain;
    const height = yAxis.height;
    const yVal = yAxis.y;
    scale = (val: number) => {
      if (max === min) return yVal + height / 2;
      const pct = (val - min) / (max - min);
      return yVal + height - pct * height;
    };
  } else {
    // Robust fallback scale using global domain
    const domain = (window as any)._chartYDomains?.[payload?.ticker] || (window as any)._chartYDomain || [100, 200];
    const [min, max] = domain;
    const height = 240; // Approx height of SVG
    const yVal = 15;    // Approx top offset of SVG
    scale = (val: number) => {
      const range = max - min;
      if (range === 0) return yVal + height / 2;
      const pct = (val - min) / range;
      return yVal + height - pct * height;
    };
  }

  const yOpen = scale(o);
  const yClose = scale(c);
  const yHigh = scale(h);
  const yLow = scale(l);
  const isUp = c >= o;
  
  const color = isUp ? '#10b981' : '#f43f5e';
  const cx = cleanX + cleanW / 2;

  return (
    <g id={`candle-${cleanX}-${cleanW}`}>
      {/* Wick line */}
      <line x1={cx} y1={yHigh} x2={cx} y2={yLow} stroke={color} strokeWidth={1.5} />
      {/* Body rectangle */}
      <rect
        x={cleanX}
        y={Math.min(yOpen, yClose)}
        width={cleanW}
        height={Math.max(Math.abs(yOpen - yClose), 1.5)}
        fill={color}
        stroke={color}
        strokeWidth={1}
        fillOpacity={0.8}
      />
    </g>
  );
}

export default function App() {
  // ----------------------------------------------------
  // Firebase Auth & Synchronization States
  // ----------------------------------------------------
  const [user, setUser] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(true);

  // ----------------------------------------------------
  // State Initialization
  // ----------------------------------------------------
  const [selectedTicker, setSelectedTicker] = useState<string>('AAPL');
  const [isBotRunning, setIsBotRunning] = useState<boolean>(true);
  const [simulationSpeed, setSimulationSpeed] = useState<number>(1.5); // seconds per tick
  const [activeSidebarTab, setActiveSidebarTab] = useState<string>('cockpit-section');
  
  // Market data state: mapping ticker -> candles history (initialized with seed data for zero-latency load)
  const [marketData, setMarketData] = useState<Record<string, Candle[]>>(() => {
    const initial: Record<string, Candle[]> = {};
    for (const ticker of Object.keys(TICKER_INFO)) {
      const raw = generateSeedData(ticker, 120, '5m');
      initial[ticker] = computeAllIndicators(raw, {
        smaShortPeriod: 9,
        smaLongPeriod: 21,
        macdFastPeriod: 12,
        macdSlowPeriod: 26,
        macdSignalPeriod: 9,
        rsiPeriod: 14,
      });
    }
    return initial;
  });
  const [apiError, setApiError] = useState<string | null>(null);

  const [viewDensity, setViewDensity] = useState<'clean' | 'standard' | 'pro'>('standard');
  const [isGuideOpen, setIsGuideOpen] = useState<boolean>(false);

  const [crosshairEnabled, setCrosshairEnabled] = useState<boolean>(true);
  const [crosshairLabel, setCrosshairLabel] = useState<string | null>(null);
  const [crosshairYPercent, setCrosshairYPercent] = useState<number | null>(null);

  const handleChartMouseMove = useCallback((state: any, e: any) => {
    if (!crosshairEnabled) return;
    if (state && state.activeLabel) {
      setCrosshairLabel(state.activeLabel);
    }
    if (e && e.clientY) {
      const container = e.currentTarget.closest('.relative-chart-container') || e.currentTarget;
      const rect = container.getBoundingClientRect();
      const y = e.clientY - rect.top;
      const yPercent = Math.max(0, Math.min(100, (y / rect.height) * 100));
      setCrosshairYPercent(yPercent);
    }
  }, [crosshairEnabled]);

  const handleChartMouseLeave = useCallback(() => {
    if (!crosshairEnabled) return;
    setCrosshairLabel(null);
    setCrosshairYPercent(null);
  }, [crosshairEnabled]);

  // Individual ticker auto-trade toggles ("always on top of it")
  const [automatedTickers, setAutomatedTickers] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    Object.keys(TICKER_INFO).forEach((ticker) => {
      initial[ticker] = true;
    });
    return initial;
  });

  // Chart, Timeframe, Zoom and Navigation states
  const [timeframe, setTimeframe] = useState<'1m' | '5m' | '15m' | '1h' | '1d'>('5m');
  const [chartType, setChartType] = useState<'line' | 'area' | 'bar' | 'candlestick' | 'heikin-ashi'>('candlestick');
  const [zoomCount, setZoomCount] = useState<number>(45); // number of visible candles
  const [panOffset, setPanOffset] = useState<number>(0);  // 0 means showing the most recent

  // Growth / Loss alert engine states
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [alertThreshold, setAlertThreshold] = useState<number>(0.3); // trigger alert if price changes by 0.3% over past X ticks
  const [alertWindow, setAlertWindow] = useState<number>(10); // rolling window of past ticks to measure growth or loss
  const [showOnlyUnreadAlerts, setShowOnlyUnreadAlerts] = useState<boolean>(false);
  const [activeFlashAlerts, setActiveFlashAlerts] = useState<PriceAlert[]>([]);
  const [enableAlertPopups, setEnableAlertPopups] = useState<boolean>(false); // default to false to prevent spamming
  const [isAlertBoxOpen, setIsAlertBoxOpen] = useState<boolean>(false);
  const [isSummaryModalOpen, setIsSummaryModalOpen] = useState<boolean>(false);
  const [quickTradeTicker, setQuickTradeTicker] = useState<string | null>(null);
  
  // Settings configs
  const [strategy, setStrategy] = useState<Strategy>({
    id: 'dtc_conv',
    name: 'Dynamic Technical Convergence',
    description: 'Golden Cross, RSI Overbought/Oversold Crossovers, and MACD Momentum confluence strategy.',
    parameters: {
      rsiOverbought: 70,
      rsiOversold: 30,
      smaShortPeriod: 10,
      smaLongPeriod: 30,
      macdFastPeriod: 12,
      macdSlowPeriod: 26,
      macdSignalPeriod: 9,
      trailingStopPercent: 2.0,
    }
  });

  const [brokerConfig, setBrokerConfig] = useState<BrokerConfig>({
    provider: 'alpaca',
    apiKey: '',
    apiSecret: '',
    isLive: false,
    baseUrl: 'https://paper-api.alpaca.markets'
  });

  // Account & Execution Ledgers
  const [portfolio, setPortfolio] = useState<Portfolio>({
    cash: 100000.00,
    initialBalance: 100000.00,
    realizedPnL: 0.00,
    is_live: false
  });
  
  const [positions, setPositions] = useState<Position[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [agentLogs, setAgentLogs] = useState<AgentLog[]>([]);

  // Ref to hold the current values of positions, portfolio and config to prevent stale closures in callbacks
  const positionsRef = useRef<Position[]>([]);
  const portfolioRef = useRef<Portfolio>(portfolio);
  const brokerConfigRef = useRef<BrokerConfig>(brokerConfig);
  const strategyRef = useRef<Strategy>(strategy);
  const enableAlertPopupsRef = useRef<boolean>(enableAlertPopups);

  positionsRef.current = positions;
  portfolioRef.current = portfolio;
  brokerConfigRef.current = brokerConfig;
  strategyRef.current = strategy;
  enableAlertPopupsRef.current = enableAlertPopups;

  // Visual Overlays toggles
  const [showSMA, setShowSMA] = useState(true);
  const [showEMA, setShowEMA] = useState(false);
  const [showBB, setShowBB] = useState(false);
  const [showInfinitron, setShowInfinitron] = useState(true);

  // Sub-charts display toggles for chosen indicators
  const [showRSI, setShowRSI] = useState(true);
  const [showVolume, setShowVolume] = useState(true);
  const [showMACD, setShowMACD] = useState(false);
  const [showStochastic, setShowStochastic] = useState(false);
  const [showATR, setShowATR] = useState(false);
  const [subChartHeightPreset, setSubChartHeightPreset] = useState<'compact' | 'balanced' | 'large'>('balanced');

  // Workspace Layout / Multi-Chart states
  const [workspaceLayout, setWorkspaceLayout] = useState<'single' | 'multi'>('single');
  const [showStrategyPanel, setShowStrategyPanel] = useState(true);
  const [activeBottomTab, setActiveBottomTab] = useState<'builder' | 'backtester'>('builder');
  const [multiChartTickers, setMultiChartTickers] = useState<string[]>(['AAPL', 'TSLA', 'MSFT', 'NVDA']);
  const [syncMultiCharts, setSyncMultiCharts] = useState<boolean>(true);

  // Independent cell-specific configurations if syncMultiCharts is disabled
  const [cellChartTypes, setCellChartTypes] = useState<Record<number, 'line' | 'area' | 'bar' | 'candlestick'>>({
    0: 'candlestick', 1: 'candlestick', 2: 'candlestick', 3: 'candlestick'
  });
  const [cellOverlays, setCellOverlays] = useState<Record<number, { showSMA: boolean; showEMA: boolean; showBB: boolean; showInfinitron: boolean }>>({
    0: { showSMA: true, showEMA: false, showBB: false, showInfinitron: true },
    1: { showSMA: true, showEMA: false, showBB: false, showInfinitron: true },
    2: { showSMA: true, showEMA: false, showBB: false, showInfinitron: true },
    3: { showSMA: true, showEMA: false, showBB: false, showInfinitron: true }
  });
  const [cellZooms, setCellZooms] = useState<Record<number, number>>({
    0: 45, 1: 45, 2: 45, 3: 45
  });
  const [cellPans, setCellPans] = useState<Record<number, number>>({
    0: 0, 1: 0, 2: 0, 3: 0
  });

  // Currency/Region support
  const [selectedCurrency, setSelectedCurrency] = useState<'USD' | 'EUR' | 'GBP' | 'ZAR' | 'JPY'>('USD');
  const CURRENCY_INFO = useMemo(() => ({
    USD: { symbol: '$', rate: 1.0, label: 'USD ($)' },
    EUR: { symbol: '€', rate: 0.92, label: 'EUR (€)' },
    GBP: { symbol: '£', rate: 0.78, label: 'GBP (£)' },
    ZAR: { symbol: 'R', rate: 18.50, label: 'ZAR (R)' },
    JPY: { symbol: '¥', rate: 155.00, label: 'JPY (¥)' },
  }), []);

  const formatPrice = (val: number) => {
    const info = CURRENCY_INFO[selectedCurrency];
    const converted = val * info.rate;
    if (selectedCurrency === 'JPY') {
      return `${info.symbol}${Math.round(converted).toLocaleString()}`;
    }
    return `${info.symbol}${converted.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // ELI5 Mode state (Explain Like I'm 5 🧸)
  const [eli5Mode, setEli5Mode] = useState<boolean>(false);

  // Realized PnL per stock tracker
  const [realizedPnLByTicker, setRealizedPnLByTicker] = useState<Record<string, number>>({});

  // Dynamic risk strategies / smart allocation rules per ticker
  const [smartStrategyRules, setSmartStrategyRules] = useState<Record<string, {
    ticker: string;
    isEnabled: boolean;
    withdrawThresholdPercent: number;    // drop % e.g. 3.0
    withdrawPercentage: number;          // withdraw % e.g. 50.0
    scaleUpThresholdPercent: number;     // gain % e.g. 5.0
    scaleUpIncrementPercent: number;    // scale up increment % e.g. 20.0
    stats: {
      originalInvestment: number;
      currentInvestmentValue: number;
      withdrawnCapitalCash: number;
      totalEarnedOrLost: number;
      status: 'idle' | 'withdrawn' | 'boosted' | 'bust';
    }
  }>>(() => {
    const initial: Record<string, any> = {};
    ['AAPL', 'TSLA', 'MSFT', 'NVDA', 'COIN', 'BTC_USD'].forEach((ticker) => {
      initial[ticker] = {
        ticker,
        isEnabled: true,
        withdrawThresholdPercent: 3.0,
        withdrawPercentage: 50.0,
        scaleUpThresholdPercent: 5.0,
        scaleUpIncrementPercent: 20.0,
        stats: {
          originalInvestment: 0,
          currentInvestmentValue: 0,
          withdrawnCapitalCash: 0,
          totalEarnedOrLost: 0,
          status: 'idle',
        }
      };
    });
    return initial;
  });

  // Theme state
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('theme');
      if (saved === 'light' || saved === 'dark') return saved;
      return 'dark'; // default to dark
    }
    return 'dark';
  });

  // Theme effect to toggle "dark" class on documentElement
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Chart Customization properties (Exposing lightweight parameter layers to the UI)
  const [priceScaleAxis, setPriceScaleAxis] = useState<'left' | 'right'>('right');
  const [showGridH, setShowGridH] = useState<boolean>(true);
  const [showGridV, setShowGridV] = useState<boolean>(true);

  // ----------------------------------------------------
  // Firebase Auth State Listener & Terminal Syncer
  // ----------------------------------------------------
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        try {
          // Load existing user data from Firestore
          const userData = await loadUserTerminalData(currentUser.uid);
          
          if (userData) {
            setPortfolio(userData.portfolio);
            setPositions(userData.positions);
            setStrategy(userData.strategy);
            setBrokerConfig(userData.brokerConfig);
            setOrders(userData.orders);
            setAlerts(userData.alerts);
            if (userData.logs && userData.logs.length > 0) {
              setAgentLogs(userData.logs);
            }
          }
          addLog('MASTER_CHIEF', 'SUCCESS', `Institutional terminal synced for ${currentUser.displayName || currentUser.email}.`);
        } catch (error) {
          console.error('Error synchronizing user data:', error);
          addLog('MASTER_CHIEF', 'WARNING', 'Failed to synchronize terminal with Firestore. Fallback simulation running.');
        }
      } else {
        setUser(null);
      }
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // 1. Reactive Sync for Portfolio & Positions
  useEffect(() => {
    if (user && user.uid !== 'local-sandbox-user') {
      savePortfolioState(user.uid, portfolio, positions);
    }
  }, [user, portfolio, positions]);

  // 2. Reactive Sync for Active Strategy Rules
  useEffect(() => {
    if (user && user.uid !== 'local-sandbox-user') {
      saveActiveStrategy(user.uid, strategy);
    }
  }, [user, strategy]);

  // 3. Reactive Sync for API Credentials
  useEffect(() => {
    if (user && user.uid !== 'local-sandbox-user') {
      saveBrokerConfig(user.uid, brokerConfig);
    }
  }, [user, brokerConfig]);

  // 4. Reactive Sync for Historical Orders Ledger
  useEffect(() => {
    if (user && user.uid !== 'local-sandbox-user' && orders.length > 0) {
      const newestOrder = orders[0];
      if (newestOrder) {
        saveOrderRecord(user.uid, newestOrder);
      }
    }
  }, [user, orders]);

  // 5. Reactive Sync for Active Price Alerts
  useEffect(() => {
    if (user && user.uid !== 'local-sandbox-user') {
      syncAllAlerts(user.uid, alerts);
    }
  }, [user, alerts]);

  // 6. Reactive Sync for Quant Logs
  useEffect(() => {
    if (user && user.uid !== 'local-sandbox-user' && agentLogs.length > 0) {
      saveAuditLogs(user.uid, agentLogs);
    }
  }, [user, agentLogs]);

  // ----------------------------------------------------
  // Historical Market Feed API Client (Real/Fallback Data)
  // ----------------------------------------------------
  useEffect(() => {
    let active = true;
    async function loadAllTickers() {
      const initialData: Record<string, Candle[]> = {};
      const tickers = Object.keys(TICKER_INFO);
      
      addLog('DATA_INDICATOR', 'INFO', `Establishing market data connection for ${timeframe}...`);
      
      for (const ticker of tickers) {
        try {
          const res = await fetch(`/api/market/history?ticker=${ticker}&timeframe=${timeframe}&limit=120`);
          let rawOHLCV: OHLCV[] = [];

          if (res.ok) {
            const data = await res.json();
            rawOHLCV = data.bars || [];
          }
          
          if (!rawOHLCV || rawOHLCV.length === 0) {
            console.warn(`[App] Using seed fallback data for ${ticker}`);
            rawOHLCV = generateSeedData(ticker, 120, timeframe);
          }
          
          const computed = computeAllIndicators(rawOHLCV, {
            smaShortPeriod: strategy.parameters.smaShortPeriod,
            smaLongPeriod: strategy.parameters.smaLongPeriod,
            macdFastPeriod: strategy.parameters.macdFastPeriod,
            macdSlowPeriod: strategy.parameters.macdSlowPeriod,
            macdSignalPeriod: strategy.parameters.macdSignalPeriod,
            rsiPeriod: 14,
          });
          initialData[ticker] = computed;
        } catch (err: any) {
          console.error(`Error loading history for ${ticker}, generating seed fallback:`, err);
          const rawOHLCV = generateSeedData(ticker, 120, timeframe);
          const computed = computeAllIndicators(rawOHLCV, {
            smaShortPeriod: strategy.parameters.smaShortPeriod,
            smaLongPeriod: strategy.parameters.smaLongPeriod,
            macdFastPeriod: strategy.parameters.macdFastPeriod,
            macdSlowPeriod: strategy.parameters.macdSlowPeriod,
            macdSignalPeriod: strategy.parameters.macdSignalPeriod,
            rsiPeriod: 14,
          });
          initialData[ticker] = computed;
        }
      }
      
      if (active) {
        setApiError(null);
        setMarketData(initialData);
        addLog('DATA_INDICATOR', 'SUCCESS', `Market data feeds active & synced for ${timeframe}.`);
      }
    }
    
    loadAllTickers();
    return () => { active = false; };
  }, [timeframe]);

  // ----------------------------------------------------
  // Live WebSocket Tick Stream Client
  // ----------------------------------------------------
  useEffect(() => {
    let ws: WebSocket | null = null;
    let reconnectTimeout: any = null;
    let active = true;

    function connect() {
      if (!active) return;
      
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/api/market/stream`;
      
      console.log(`[WSClient] Connecting to live ticker bridge ${wsUrl} for ${selectedTicker}`);
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log('[WSClient] Connection established.');
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            action: 'subscribe',
            ticker: selectedTicker
          }));
        }
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'live' && data.ticker === selectedTicker) {
            setMarketData((prev) => {
              const list = prev[selectedTicker];
              if (!list || list.length === 0) return prev;
              
              const updated = [...list];
              const last = updated[updated.length - 1];
              
              const newClose = data.price;
              const newHigh = Math.max(last.high, newClose);
              const newLow = Math.min(last.low, newClose);
              
              updated[updated.length - 1] = {
                ...last,
                close: newClose,
                high: newHigh,
                low: newLow,
              };
              
              return {
                ...prev,
                [selectedTicker]: updated
              };
            });
          }
        } catch (err: any) {
          console.error('[WSClient] Failed to parse live tick:', err.message);
        }
      };

      ws.onclose = () => {
        if (active) {
          reconnectTimeout = setTimeout(connect, 4000);
        }
      };

      ws.onerror = (err) => {
        console.log('[WSClient] Stream state change or pending reconnect...');
      };
    }

    connect();

    return () => {
      active = false;
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (ws) {
        ws.close();
      }
    };
  }, [selectedTicker]);

  // Sync is_live state between brokerConfig and portfolio
  useEffect(() => {
    setPortfolio(prev => ({ ...prev, is_live: brokerConfig.isLive }));
    addLog('RISK_PORTFOLIO', 'WARNING', `Trading Environment switched to: ${brokerConfig.isLive ? '🔴 LIVE REAL-MONEY TRADING' : '🟢 PAPER-TRADING SANDBOX'}`);
  }, [brokerConfig.isLive]);

  // Recalculate indicators if periods change in Strategy Builder
  useEffect(() => {
    setMarketData((prev) => {
      const updated: Record<string, Candle[]> = {};
      Object.keys(prev).forEach((ticker) => {
        const candles = prev[ticker];
        const rawOHLCV: OHLCV[] = candles.map(({ time, open, high, low, close, volume }) => ({
          time, open, high, low, close, volume
        }));
        updated[ticker] = computeAllIndicators(rawOHLCV, {
          smaShortPeriod: strategy.parameters.smaShortPeriod,
          smaLongPeriod: strategy.parameters.smaLongPeriod,
          macdFastPeriod: strategy.parameters.macdFastPeriod,
          macdSlowPeriod: strategy.parameters.macdSlowPeriod,
          macdSignalPeriod: strategy.parameters.macdSignalPeriod,
          rsiPeriod: 14,
        });
      });
      return updated;
    });
    addLog('DATA_INDICATOR', 'INFO', `Recalculated indicators based on new user parameters. Short SMA: ${strategy.parameters.smaShortPeriod}, Long SMA: ${strategy.parameters.smaLongPeriod}.`);
  }, [
    strategy.parameters.smaShortPeriod,
    strategy.parameters.smaLongPeriod,
    strategy.parameters.macdFastPeriod,
    strategy.parameters.macdSlowPeriod,
    strategy.parameters.macdSignalPeriod,
  ]);

  // ----------------------------------------------------
  // Log Helper
  // ----------------------------------------------------
  function addLog(
    agent: AgentLog['agent'],
    type: AgentLog['type'],
    message: string
  ) {
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setAgentLogs((prev) => [
      ...prev,
      {
        id: Math.random().toString(36).substring(7),
        agent,
        type,
        message,
        timestamp: timeStr,
      },
    ].slice(-150)); // limit log cache sizes
  }

  // ----------------------------------------------------
  // Real-time market tick interval loop
  // ----------------------------------------------------
  useEffect(() => {
    if (!isBotRunning) return;

    const interval = setInterval(() => {
      const triggeredAlerts: PriceAlert[] = [];

      setMarketData((prev) => {
        const nextData = { ...prev };
        
        Object.keys(TICKER_INFO).forEach((ticker) => {
          const candles = prev[ticker];
          if (!candles || candles.length === 0) return;

          const lastCandle = candles[candles.length - 1];
          // Simulating highly realistic market ticks
          const nextOHLCV = generateNextCandle(ticker, lastCandle, timeframe);
          
          // Re-calculate math indicators with the new candle
          const updatedHistory = [...candles, { ...nextOHLCV, indicators: {} }].slice(-100); // keep window compact
          const recomputed = computeAllIndicators(
            updatedHistory.map(c => ({
              time: c.time,
              open: c.open,
              high: c.high,
              low: c.low,
              close: c.close,
              volume: c.volume
            })),
            {
              smaShortPeriod: strategyRef.current.parameters.smaShortPeriod,
              smaLongPeriod: strategyRef.current.parameters.smaLongPeriod,
              macdFastPeriod: strategyRef.current.parameters.macdFastPeriod,
              macdSlowPeriod: strategyRef.current.parameters.macdSlowPeriod,
              macdSignalPeriod: strategyRef.current.parameters.macdSignalPeriod,
              rsiPeriod: 14,
            }
          );

          // Get evaluation signals
          const signal = evaluateSignals(recomputed, strategyRef.current);
          const finalCandles = [...recomputed];
          finalCandles[finalCandles.length - 1].signal = signal;
          nextData[ticker] = finalCandles;

          // Alert Logic Check for Momentum Growth or Loss
          if (finalCandles.length >= alertWindow) {
            const currentClose = finalCandles[finalCandles.length - 1].close;
            const pastCandle = finalCandles[finalCandles.length - alertWindow];
            const pastClose = pastCandle.close;
            const changePercent = ((currentClose - pastClose) / pastClose) * 100;

            if (Math.abs(changePercent) >= alertThreshold) {
              const direction = changePercent > 0 ? 'GROWTH' : 'LOSS';
              const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
              
              triggeredAlerts.push({
                id: 'ALT-' + Math.random().toString(36).substring(3, 8).toUpperCase(),
                ticker,
                price: currentClose,
                changePercent,
                direction,
                timestamp,
                acknowledged: false
              });
            }
          }

          // Trigger log on new tick calculation for selectedTicker
          if (ticker === selectedTicker) {
            const currentC = finalCandles[finalCandles.length - 1];
            addLog(
              'DATA_INDICATOR',
              'INFO',
              `Tick received for ${ticker}: Price $${currentC.close.toFixed(2)} | RSI: ${currentC.indicators.rsi?.toFixed(1) || 'N/A'} | MACD: ${currentC.indicators.macd?.macdLine.toFixed(2) || 'N/A'}`
            );
          }

          // Automated order placement triggers (Agent Decision Block)
          handleAutoSignals(ticker, finalCandles, signal);
        });

        return nextData;
      });

      // Update Alerts state if any triggered
      if (triggeredAlerts.length > 0) {
        setAlerts((prev) => {
          // Filter out duplicate alerts for the same ticker/direction that are still unacknowledged within 5s
          const filteredTriggered = triggeredAlerts.filter(newAlt => {
            const isRecentDup = prev.some(
              oldAlt => oldAlt.ticker === newAlt.ticker && 
                        oldAlt.direction === newAlt.direction && 
                        !oldAlt.acknowledged && 
                        Math.abs(oldAlt.changePercent - newAlt.changePercent) < 0.15
            );
            return !isRecentDup;
          });
          
          if (filteredTriggered.length === 0) return prev;

          // Log alerts to the quantitative system log
          filteredTriggered.forEach((alt) => {
            addLog(
              'DATA_INDICATOR',
              'WARNING',
              `🚨 [Alert Engine] ${alt.ticker} detected ${alt.direction === 'GROWTH' ? 'GROWTH SPIKE' : 'LOSS DROP'} of ${alt.changePercent.toFixed(2)}% at $${alt.price.toFixed(2)}.`
            );
          });

          // Trigger temporary flash banners for each non-duplicate alert only if popups are enabled
          if (enableAlertPopupsRef.current) {
            setTimeout(() => {
              setActiveFlashAlerts(prevFlash => {
                const uniqueFiltered = filteredTriggered.filter(
                  alt => !prevFlash.some(f => f.id === alt.id)
                );
                if (uniqueFiltered.length === 0) return prevFlash;

                const merged = [...uniqueFiltered, ...prevFlash];
                const uniqueMerged = Array.from(new Map(merged.map(item => [item.id, item])).values());
                const newFlash = uniqueMerged.slice(0, 3);

                uniqueFiltered.forEach(alt => {
                  setTimeout(() => {
                    setActiveFlashAlerts(current => current.filter(item => item.id !== alt.id));
                  }, 8000); // 8 seconds auto-dismiss
                });
                return newFlash;
              });
            }, 0);
          }

          return [...filteredTriggered, ...prev].slice(0, 40);
        });
      }

      // [Risk Agent] - Process stop loss trailing limits and update floating PnL
      evaluatePortfolioPnLandStops();

    }, simulationSpeed * 1000);

    return () => clearInterval(interval);
  }, [isBotRunning, simulationSpeed, selectedTicker, alertThreshold, alertWindow, automatedTickers, timeframe]);

  // ----------------------------------------------------
  // Automated execution triggers based on Agent rules
  // ----------------------------------------------------
  function handleAutoSignals(ticker: string, candles: Candle[], signal: 'BUY' | 'SELL' | 'HOLD') {
    // Check if this specific ticker has automation enabled
    if (!automatedTickers[ticker]) return;
    if (signal === 'HOLD') return;

    const currentCandle = candles[candles.length - 1];
    const price = currentCandle.close;
    const currentPositions = positionsRef.current;
    const existingPos = currentPositions.find(p => p.ticker === ticker);

    if (signal === 'BUY' && !existingPos) {
      // Determine quantity based on maximum 15% cash allocation per trade to comply with risk agents rules
      const allocation = portfolioRef.current.cash * 0.15;
      const qty = Math.floor(allocation / price);
      if (qty > 0) {
        executeOrder(ticker, 'BUY', price, qty, `Automated [Data & Indicator] confluence trigger.`);
      }
    } else if (signal === 'SELL' && existingPos) {
      // Sell full existing position
      executeOrder(ticker, 'SELL', price, existingPos.quantity, `Automated [Data & Indicator] overbought trend reversal.`);
    }
  }

  // ----------------------------------------------------
  // Execution Agent: Routes orders based on IS_LIVE check
  // ----------------------------------------------------
  function executeOrder(ticker: string, side: 'BUY' | 'SELL', price: number, qty: number, reason: string) {
    const isLive = brokerConfigRef.current.isLive;
    const latency = Math.floor(Math.random() * 60) + 15; // simulate real connection latency
    const amount = Number((price * qty).toFixed(2));

    addLog(
      'EXECUTION_BROKER',
      'TRADE',
      `Initializing payload array: ${side} ${qty} shares of ${ticker} @ $${price.toFixed(2)}. Latency: ${latency}ms. Routing to: ${isLive ? '🔴 LIVE REAL-EXCHANGE' : '🟢 SANDBOX SIMULATOR'}`
    );

    // Validate if paper trading can afford it
    if (side === 'BUY' && portfolioRef.current.cash < amount) {
      addLog('RISK_PORTFOLIO', 'WARNING', `Trade rejected: Insufficient funds to allocate $${amount.toFixed(2)}.`);
      return;
    }

    // Process Ledger State Updates
    setTimeout(() => {
      const orderId = 'ORD-' + Math.random().toString(36).substring(3, 8).toUpperCase();
      const newOrder: Order = {
        id: orderId,
        ticker,
        side,
        type: 'MARKET',
        price,
        quantity: qty,
        amount,
        status: 'FILLED',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        is_live: isLive,
        notes: reason,
        execution_latency_ms: latency
      };

      setOrders(prev => [newOrder, ...prev]);

      // Update Portfolio & Positions Cash Ledgers (Redis simulation style)
      setPortfolio(prev => {
        const cashChange = side === 'BUY' ? -amount : amount;
        const newCash = Number((prev.cash + cashChange).toFixed(2));
        return {
          ...prev,
          cash: newCash,
        };
      });

      setPositions(prev => {
        const idx = prev.findIndex(p => p.ticker === ticker);
        if (idx === -1) {
          if (side === 'BUY') {
            // New Position setup with trailing stop initialized
            const stopPrice = Number((price * (1 - strategyRef.current.parameters.trailingStopPercent / 100)).toFixed(2));
            return [...prev, {
              ticker,
              quantity: qty,
              averagePrice: price,
              currentPrice: price,
              unrealizedPnL: 0,
              trailingStopPrice: stopPrice,
              is_live: isLive
            }];
          }
        } else {
          const existing = prev[idx];
          if (side === 'SELL') {
            const updated = [...prev];
            // Realize PnL and remove position
            const profit = (price - existing.averagePrice) * existing.quantity;
            setPortfolio(p => ({
              ...p,
              realizedPnL: Number((p.realizedPnL + profit).toFixed(2))
            }));
            setRealizedPnLByTicker(prevPnL => ({
              ...prevPnL,
              [ticker]: Number(((prevPnL[ticker] || 0) + profit).toFixed(2))
            }));
            updated.splice(idx, 1);
            return updated;
          } else {
            // Adding to position (averaging cost)
            const updated = [...prev];
            const newQty = existing.quantity + qty;
            const newAvgPrice = Number(((existing.averagePrice * existing.quantity + amount) / newQty).toFixed(2));
            const stopPrice = Number((price * (1 - strategyRef.current.parameters.trailingStopPercent / 100)).toFixed(2));
            
            updated[idx] = {
              ...existing,
              quantity: newQty,
              averagePrice: newAvgPrice,
              currentPrice: price,
              trailingStopPrice: stopPrice
            };
            return updated;
          }
        }
        return prev;
      });

      addLog(
        'RISK_PORTFOLIO',
        'SUCCESS',
        `Position updated. Ticker: ${ticker} | Shares: ${qty} | Realized cash balance change: $${(side === 'BUY' ? -amount : amount).toFixed(2)}`
      );

    }, latency);
  }

  // ----------------------------------------------------
  // Risk Agent: Evaluates floating PnL, trailing stops, & smart allocation strategies
  // ----------------------------------------------------
  function evaluatePortfolioPnLandStops() {
    const currentPositions = positionsRef.current;
    if (currentPositions.length === 0) return;

    // Get current stock prices
    const prices: Record<string, number> = {};
    Object.keys(marketData).forEach((ticker) => {
      const history = marketData[ticker];
      if (history && history.length > 0) {
        prices[ticker] = history[history.length - 1].close;
      }
    });

    const stopPercent = strategyRef.current.parameters.trailingStopPercent;

    const updatedStops = processRiskAndTrailingStops(
      currentPositions,
      prices,
      stopPercent,
      (ticker, triggerPrice) => {
        // Trailing Stop trigger callback
        const pos = positionsRef.current.find(p => p.ticker === ticker);
        if (pos) {
          addLog(
            'RISK_PORTFOLIO',
            'WARNING',
            `⚠️ [Trailing Stop Triggered] ${ticker} fell below protection ceiling of $${pos.trailingStopPrice?.toFixed(2)}. Initiating execution block liquidation.`
          );
          executeOrder(ticker, 'SELL', triggerPrice, pos.quantity, `[Risk System Stop Out] Trailing stop triggered.`);
        }
      }
    );

    // Run custom Smart Allocation Strategies on the active positions
    const finalPositions = updatedStops.map(pos => {
      const ticker = pos.ticker;
      const currentPrice = prices[ticker];
      if (!currentPrice) return pos;

      const rule = smartStrategyRules[ticker];
      if (!rule || !rule.isEnabled) return pos;

      // Calculate price change from entry (averagePrice)
      const changeFromEntryPercent = ((currentPrice - pos.averagePrice) / pos.averagePrice) * 100;
      let updatedPos = { ...pos };

      // A. Emergency Partial Stop Loss Drop (Candy Saver 🍬)
      if (changeFromEntryPercent <= -rule.withdrawThresholdPercent && rule.stats.status !== 'withdrawn' && rule.stats.status !== 'bust') {
        const withdrawPct = rule.withdrawPercentage; // e.g. 50%
        const qtyToWithdraw = Math.floor(pos.quantity * (withdrawPct / 100));

        if (qtyToWithdraw > 0) {
          const withdrawnCashAmount = qtyToWithdraw * currentPrice;
          
          addLog(
            'CANDY_SAVER',
            'WARNING',
            `🍬 [Candy Saver] ${ticker} dropped by ${Math.abs(changeFromEntryPercent).toFixed(2)}% (Limit: -${rule.withdrawThresholdPercent}%). Withdrawing ${withdrawPct}% (${qtyToWithdraw} shares) to lock in and keep ${formatPrice(withdrawnCashAmount)} CASH safe in your piggy bank! 🛡️`
          );

          // Realize cash and fractional PnL
          setPortfolio(p => ({
            ...p,
            cash: Number((p.cash + withdrawnCashAmount).toFixed(2))
          }));

          const profit = (currentPrice - pos.averagePrice) * qtyToWithdraw;
          setRealizedPnLByTicker(prevPnL => ({
            ...prevPnL,
            [ticker]: Number(((prevPnL[ticker] || 0) + profit).toFixed(2))
          }));

          setSmartStrategyRules(prevRules => ({
            ...prevRules,
            [ticker]: {
              ...prevRules[ticker],
              stats: {
                ...prevRules[ticker].stats,
                withdrawnCapitalCash: prevRules[ticker].stats.withdrawnCapitalCash + withdrawnCashAmount,
                totalEarnedOrLost: prevRules[ticker].stats.totalEarnedOrLost + profit,
                status: 'withdrawn'
              }
            }
          }));

          // Reduce position qty
          updatedPos.quantity = pos.quantity - qtyToWithdraw;
          updatedPos.unrealizedPnL = (currentPrice - pos.averagePrice) * updatedPos.quantity;

          // Add execution order to log/ledger
          const orderId = 'ORD-' + Math.random().toString(36).substring(3, 8).toUpperCase();
          const newOrder: Order = {
            id: orderId,
            ticker,
            side: 'SELL',
            type: 'MARKET',
            price: currentPrice,
            quantity: qtyToWithdraw,
            amount: withdrawnCashAmount,
            status: 'FILLED',
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            is_live: brokerConfigRef.current.isLive,
            notes: `[Smart Stop Out] Preserved ${withdrawPct}% of capital.`,
            execution_latency_ms: Math.floor(Math.random() * 40) + 10
          };
          setOrders(prev => [newOrder, ...prev]);
        }
      }

      // B. Trend Booster Scale-In (Increase Amount 🚀)
      if (changeFromEntryPercent >= rule.scaleUpThresholdPercent && rule.stats.status !== 'boosted') {
        const boostPct = rule.scaleUpIncrementPercent; // e.g. 20%
        const currentCost = pos.quantity * pos.averagePrice;
        const targetCostToAdd = currentCost * (boostPct / 100);

        if (portfolioRef.current.cash >= targetCostToAdd) {
          const qtyToBuy = Math.floor(targetCostToAdd / currentPrice);
          if (qtyToBuy > 0) {
            const actualCost = qtyToBuy * currentPrice;

            addLog(
              'TREND_BOOSTER',
              'SUCCESS',
              `🚀 [Trend Booster] ${ticker} is soaring! Up by +${changeFromEntryPercent.toFixed(2)}% (Limit: +${rule.scaleUpThresholdPercent}%). Adding ${boostPct}% more shares (+${qtyToBuy} shares, costing ${formatPrice(actualCost)}) to capture maximum gains! 📈`
            );

            // Subtract cash
            setPortfolio(p => ({
              ...p,
              cash: Number((p.cash - actualCost).toFixed(2))
            }));

            setSmartStrategyRules(prevRules => ({
              ...prevRules,
              [ticker]: {
                ...prevRules[ticker],
                stats: {
                  ...prevRules[ticker].stats,
                  status: 'boosted'
                }
              }
            }));

            // Average position cost
            const newQty = pos.quantity + qtyToBuy;
            const newAvgPrice = Number(((pos.averagePrice * pos.quantity + actualCost) / newQty).toFixed(2));

            updatedPos.quantity = newQty;
            updatedPos.averagePrice = newAvgPrice;
            updatedPos.unrealizedPnL = (currentPrice - newAvgPrice) * newQty;

            // Add execution order
            const orderId = 'ORD-' + Math.random().toString(36).substring(3, 8).toUpperCase();
            const newOrder: Order = {
              id: orderId,
              ticker,
              side: 'BUY',
              type: 'MARKET',
              price: currentPrice,
              quantity: qtyToBuy,
              amount: actualCost,
              status: 'FILLED',
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
              is_live: brokerConfigRef.current.isLive,
              notes: `[Trend Booster] Scaled in +${boostPct}% position size`,
              execution_latency_ms: Math.floor(Math.random() * 40) + 10
            };
            setOrders(prev => [newOrder, ...prev]);
          }
        }
      }

      return updatedPos;
    });

    setPositions(finalPositions);
  }

  // ----------------------------------------------------
  // Manual Actions
  // ----------------------------------------------------
  const handleManualTrade = (side: 'BUY' | 'SELL') => {
    const ticker = selectedTicker;
    const history = marketData[ticker];
    if (!history || history.length === 0) return;
    const price = history[history.length - 1].close;

    if (side === 'BUY') {
      const qty = Math.floor((portfolio.cash * 0.1) / price) || 1; // buy 10% cash size
      executeOrder(ticker, 'BUY', price, qty, 'Manual User override placement.');
    } else {
      const pos = positions.find(p => p.ticker === ticker);
      if (!pos) {
        alert(`You hold no open positions for ${ticker} to liquidate.`);
        return;
      }
      executeOrder(ticker, 'SELL', price, pos.quantity, 'Manual User override liquidation.');
    }
  };

  const handleManualLiquidateAll = () => {
    if (positions.length === 0) return;
    addLog('RISK_PORTFOLIO', 'WARNING', 'User clicked manual EMERGENCY ALL LIQUIDATION. Sending immediate market orders to broker broker pools.');
    positions.forEach((pos) => {
      const history = marketData[pos.ticker];
      if (history && history.length > 0) {
        const price = history[history.length - 1].close;
        executeOrder(pos.ticker, 'SELL', price, pos.quantity, 'EMERGENCY LIQUIDATION OVERRIDE.');
      }
    });
  };

  const onAddTicker = (tickerSymbol: string) => {
    const symbol = tickerSymbol.trim().toUpperCase();
    if (!symbol) return;
    if (marketData[symbol]) {
      // If already exists, just select it
      setSelectedTicker(symbol);
      addLog('DATA_INDICATOR', 'INFO', `Ticker ${symbol} is already loaded. Switching active dashboard view.`);
      return;
    }

    // Add ticker to automatedTickers, set to true by default
    setAutomatedTickers(prev => ({ ...prev, [symbol]: true }));

    // Initialize default smart strategy rules for the new ticker
    setSmartStrategyRules(prev => {
      if (prev[symbol]) return prev;
      return {
        ...prev,
        [symbol]: {
          ticker: symbol,
          isEnabled: true,
          withdrawThresholdPercent: 3.0,
          withdrawPercentage: 50.0,
          scaleUpThresholdPercent: 5.0,
          scaleUpIncrementPercent: 20.0,
          stats: {
            originalInvestment: 0,
            currentInvestmentValue: 0,
            withdrawnCapitalCash: 0,
            totalEarnedOrLost: 0,
            status: 'idle',
          }
        }
      };
    });

    // Generate initial historical candles for this new ticker
    const rawOHLCV = generateSeedData(symbol, 70, timeframe);
    const computed = computeAllIndicators(rawOHLCV, {
      smaShortPeriod: strategyRef.current.parameters.smaShortPeriod,
      smaLongPeriod: strategyRef.current.parameters.smaLongPeriod,
      macdFastPeriod: strategyRef.current.parameters.macdFastPeriod,
      macdSlowPeriod: strategyRef.current.parameters.macdSlowPeriod,
      macdSignalPeriod: strategyRef.current.parameters.macdSignalPeriod,
      rsiPeriod: 14,
    });

    setMarketData(prev => ({
      ...prev,
      [symbol]: computed
    }));

    setSelectedTicker(symbol);

    addLog('DATA_INDICATOR', 'SUCCESS', `Added new ticker ${symbol} to the live simulation workspace. Historical indicators initialized.`);
  };

  // Calculations for dashboard
  const currentPrices: Record<string, number> = {};
  Object.keys(marketData).forEach((ticker) => {
    const history = marketData[ticker];
    if (history && history.length > 0) {
      currentPrices[ticker] = history[history.length - 1].close;
    }
  });

  const totalUnrealizedPnL = positions.reduce((sum, pos) => {
    const currentPrice = currentPrices[pos.ticker] || pos.averagePrice;
    return sum + (currentPrice - pos.averagePrice) * pos.quantity;
  }, 0);

  const totalEquity = portfolio.cash + positions.reduce((sum, pos) => {
    const currentPrice = currentPrices[pos.ticker] || pos.averagePrice;
    return sum + (currentPrice * pos.quantity);
  }, 0);

  const activeCandles = marketData[selectedTicker] || [];
  const currentCandle = activeCandles[activeCandles.length - 1];

  // Map simulated execution scatters to chart for premium UI visual
  const chartPoints = activeCandles.map((c) => {
    // Check if we have orders filled at this timestamp or price
    const orderAtPoint = orders.find(
      (o) => o.ticker === selectedTicker && o.timestamp === c.time
    );

    return {
      ...c,
      buySignalPoint: orderAtPoint?.side === 'BUY' ? c.close : null,
      sellSignalPoint: orderAtPoint?.side === 'SELL' ? c.close : null,
    };
  });

  // Helper to get sliced chart points for any ticker
  const getSlicedChartPointsForTicker = useCallback((ticker: string, slotIndex?: number) => {
    const activeCandles = marketData[ticker] || [];
    const points = activeCandles.map((c) => {
      const orderAtPoint = orders.find(
        (o) => o.ticker === ticker && o.timestamp === c.time
      );

      return {
        ...c,
        ticker,
        buySignalPoint: orderAtPoint?.side === 'BUY' ? c.close : null,
        sellSignalPoint: orderAtPoint?.side === 'SELL' ? c.close : null,
      };
    });

    let zCount = zoomCount;
    let pOffset = panOffset;

    if (slotIndex !== undefined && !syncMultiCharts) {
      zCount = cellZooms[slotIndex] ?? zoomCount;
      pOffset = cellPans[slotIndex] ?? panOffset;
    }

    const maxPanVal = Math.max(0, points.length - zCount);
    const safePanVal = Math.min(pOffset, maxPanVal);

    let result = [];
    if (points.length <= zCount) {
      result = points;
    } else {
      const endIdx = points.length - safePanVal;
      const startIdx = Math.max(0, endIdx - zCount);
      result = points.slice(startIdx, endIdx);
    }

    if (result.length > 0) {
      const prices = result.flatMap(p => [p.open, p.close, p.high, p.low]);
      const minVal = Math.min(...prices);
      const maxVal = Math.max(...prices);
      const pad = (maxVal - minVal) * 0.05 || 1;
      if (typeof window !== 'undefined') {
        if (!(window as any)._chartYDomains) {
          (window as any)._chartYDomains = {};
        }
        (window as any)._chartYDomains[ticker] = [minVal - pad, maxVal + pad];
        
        if (ticker === selectedTicker) {
          (window as any)._chartYDomain = [minVal - pad, maxVal + pad];
        }
      }
    }

    return result;
  }, [marketData, orders, zoomCount, panOffset, syncMultiCharts, cellZooms, cellPans, selectedTicker]);

  const maxPan = Math.max(0, chartPoints.length - zoomCount);
  const safePan = Math.min(panOffset, maxPan);

  const slicedChartPoints = useMemo(() => {
    return getSlicedChartPointsForTicker(selectedTicker);
  }, [selectedTicker, getSlicedChartPointsForTicker]);

  // ----------------------------------------------------
  // Interactive Gestures (Pinch-to-zoom / Mouse-drag scroll)
  // ----------------------------------------------------
  const isDraggingRef = useRef(false);
  const startXRef = useRef(0);
  const startPanRef = useRef(0);

  const handleWheel = (e: React.WheelEvent) => {
    // Wheel up: Zoom in (decrease zoomCount)
    // Wheel down: Zoom out (increase zoomCount)
    if (e.deltaY < 0) {
      setZoomCount(prev => Math.max(15, prev - 3));
    } else {
      setZoomCount(prev => Math.min(100, prev + 3));
    }
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    isDraggingRef.current = true;
    startXRef.current = e.clientX;
    startPanRef.current = panOffset;
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDraggingRef.current) return;
    const dx = e.clientX - startXRef.current;
    // convert pixels to candle offset increments (approx. 15px per candle)
    const candlesMoved = Math.round(dx / 15);
    if (candlesMoved !== 0) {
      setPanOffset(Math.max(0, Math.min(maxPan, startPanRef.current + candlesMoved)));
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (isDraggingRef.current) {
      isDraggingRef.current = false;
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch (err) {}
    }
  };

  // Multi-Chart slot ticker selector helper
  const handleSelectSlotTicker = (index: number, nextTicker: string) => {
    if (!marketData[nextTicker]) {
      onAddTicker(nextTicker);
    }
    setMultiChartTickers(prev => {
      const next = [...prev];
      next[index] = nextTicker;
      return next;
    });
  };

  // Multi-Chart cell scroll/zoom helper
  const createCellWheelHandler = (slotIndex: number) => (e: React.WheelEvent) => {
    if (syncMultiCharts) {
      if (e.deltaY < 0) {
        setZoomCount(prev => Math.max(15, prev - 3));
      } else {
        setZoomCount(prev => Math.min(100, prev + 3));
      }
    } else {
      const currentZoom = cellZooms[slotIndex] ?? 45;
      let nextZoom = currentZoom;
      if (e.deltaY < 0) {
        nextZoom = Math.max(15, currentZoom - 3);
      } else {
        nextZoom = Math.min(100, currentZoom + 3);
      }
      setCellZooms(prev => ({ ...prev, [slotIndex]: nextZoom }));
    }
  };

  // Multi-Chart cell pointer gestures helper
  const createCellPointerHandlers = (slotIndex: number, ticker: string) => {
    let isDragging = false;
    let startX = 0;
    let startPan = 0;

    const onPointerDown = (e: React.PointerEvent) => {
      isDragging = true;
      startX = e.clientX;
      startPan = syncMultiCharts ? panOffset : (cellPans[slotIndex] ?? 0);
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch (err) {}
    };

    const onPointerMove = (e: React.PointerEvent) => {
      if (!isDragging) return;
      const dx = e.clientX - startX;
      const candlesMoved = Math.round(dx / 15);
      if (candlesMoved !== 0) {
        const activeCandles = marketData[ticker] || [];
        const zCount = syncMultiCharts ? zoomCount : (cellZooms[slotIndex] ?? 45);
        const maxPanVal = Math.max(0, activeCandles.length - zCount);
        
        if (syncMultiCharts) {
          setPanOffset(Math.max(0, Math.min(maxPanVal, startPan + candlesMoved)));
        } else {
          setCellPans(prev => ({
            ...prev,
            [slotIndex]: Math.max(0, Math.min(maxPanVal, startPan + candlesMoved))
          }));
        }
      }
    };

    const onPointerUp = (e: React.PointerEvent) => {
      if (isDragging) {
        isDragging = false;
        try {
          e.currentTarget.releasePointerCapture(e.pointerId);
        } catch (err) {}
      }
    };

    return {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerLeave: onPointerUp,
    };
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-canvas-bg text-canvas-text flex flex-col justify-center items-center gap-4">
        <div className="w-10 h-10 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
        <span className="text-xs text-panel-subtext font-mono uppercase tracking-widest animate-pulse">
          Synchronizing Institutional Ledger...
        </span>
      </div>
    );
  }

  if (!user) {
    return (
      <AuthScreen 
        onSuccess={() => {}} 
        onBypass={() => setUser({
          uid: 'local-sandbox-user',
          email: 'sandbox@quantalgo.local',
          displayName: 'Local Sandbox Trader'
        })}
      />
    );
  }

  return (
    <div className="min-h-screen bg-canvas-bg text-canvas-text flex flex-col lg:flex-row font-sans transition-colors duration-200 selection:bg-indigo-500/35 selection:text-white antialiased">
      {/* Dynamic Upper Accent Bar */}
      <div className={`h-1.5 w-full fixed top-0 left-0 z-50 ${brokerConfig.isLive ? 'bg-red-600 animate-pulse' : 'bg-indigo-600'}`} />

      {/* 1. Global Left Sidebar Panel */}
      <GlobalSidebar
        theme={theme}
        setTheme={setTheme}
        eli5Mode={eli5Mode}
        setEli5Mode={setEli5Mode}
        selectedCurrency={selectedCurrency}
        setSelectedCurrency={setSelectedCurrency}
        isBotRunning={isBotRunning}
        setIsBotRunning={setIsBotRunning}
        simulationSpeed={simulationSpeed}
        setSimulationSpeed={setSimulationSpeed}
        positionsLength={positions.length}
        onLiquidateAll={handleManualLiquidateAll}
        addLog={addLog}
        portfolioValue={totalEquity}
        formatPrice={formatPrice}
        activeSidebarTab={activeSidebarTab}
        setActiveSidebarTab={setActiveSidebarTab}
        user={user}
        onSignOut={() => signOut(auth)}
      />

      {/* 2. Main Content Wrapper */}
      <div className="flex-1 min-w-0 flex flex-col w-full h-screen lg:overflow-y-auto">
        <div className="w-full max-w-[1750px] mx-auto px-4 md:px-6 py-6 space-y-6">
          
          {/* Terminal Header */}
          <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-panel-bg p-4 rounded-xl border border-panel-border shadow-sm transition-colors duration-200">
            <div className="flex items-center gap-3">
              <div className="bg-indigo-600/10 border border-indigo-500/25 p-2 rounded-xl text-indigo-500 dark:text-indigo-400">
                <TrendingUp className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-lg font-black tracking-tight text-panel-heading flex items-center gap-1.5 flex-wrap">
                  Automated Multi-Stock Algo Trading Platform
                  <span className="bg-amber-500/10 text-amber-600 dark:text-amber-450 border border-amber-500/30 text-[9px] px-2 py-0.5 rounded-full font-mono font-bold uppercase tracking-wider">
                    Demo Sandbox
                  </span>
                </h1>
                <p className="text-xs text-panel-subtext flex items-center gap-1.5 mt-0.5">
                  <Activity size={12} className="text-emerald-500 animate-pulse" />
                  Production-grade Quantitative Sandbox Dashboard
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* Feature Guide Launcher Button */}
              <button
                onClick={() => setIsGuideOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 text-indigo-400 text-xs font-bold transition-all shadow-sm cursor-pointer"
                title="Explain terminal features in simple terms"
              >
                <HelpCircle size={14} />
                <span>Feature Guide</span>
              </button>

              {/* UI Density Selector */}
              <div className="flex items-center gap-1 bg-panel-inner-bg p-1 rounded-lg border border-panel-border text-[10px] font-bold">
                <button
                  onClick={() => setViewDensity('clean')}
                  className={`px-2 py-1 rounded transition ${
                    viewDensity === 'clean'
                      ? 'bg-indigo-600 text-white font-black'
                      : 'text-panel-subtext hover:text-panel-heading'
                  }`}
                  title="Clean, spacious view without crowded panels"
                >
                  Clean
                </button>
                <button
                  onClick={() => setViewDensity('standard')}
                  className={`px-2 py-1 rounded transition ${
                    viewDensity === 'standard'
                      ? 'bg-indigo-600 text-white font-black'
                      : 'text-panel-subtext hover:text-panel-heading'
                  }`}
                  title="Standard balanced view"
                >
                  Standard
                </button>
                <button
                  onClick={() => setViewDensity('pro')}
                  className={`px-2 py-1 rounded transition ${
                    viewDensity === 'pro'
                      ? 'bg-indigo-600 text-white font-black'
                      : 'text-panel-subtext hover:text-panel-heading'
                  }`}
                  title="Full quantitative suit"
                >
                  Pro
                </button>
              </div>

              {/* Quick Status Pill */}
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-panel-inner-bg border border-panel-border text-xs">
                <span className="flex h-1.5 w-1.5 relative">
                  <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isBotRunning ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                  <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${isBotRunning ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                </span>
                <span className="font-mono text-[10px] font-bold text-panel-subtext">
                  {isBotRunning ? 'BOT ACTIVE' : 'BOT PAUSED'}
                </span>
              </div>
            </div>
          </header>

        {/* ELI5 Mode Header Explain Callout */}
        <AnimatePresence>
          {eli5Mode && (
            <motion.div 
              initial={{ opacity: 0, height: 0, y: -10 }}
              animate={{ opacity: 1, height: 'auto', y: 0 }}
              exit={{ opacity: 0, height: 0, y: -10 }}
              className="bg-amber-500/10 border border-amber-500/30 p-4 rounded-xl text-amber-800 dark:text-amber-450 text-xs flex items-start gap-3 shadow-sm overflow-hidden"
            >
              <span className="text-xl shrink-0">🧸</span>
              <div className="space-y-1">
                <p className="font-bold text-amber-900 dark:text-amber-300">Welcome to Toddler-Friendly Mode! Let's understand your Piggy Bank:</p>
                <p className="leading-relaxed opacity-90">
                  Imagine you have a big cookie jar! 🍪 <strong>Available Cash</strong> is how many tasty cookies you have in your jar right now to buy toys. 
                  <strong>Floating P&L</strong> is how much happier your toys became since you got them (green means they got balloons 🎈, red means they fell on the slide 🛝). 
                  <strong>Realized Net Returns</strong> is when you traded a toy away and kept the cookies safe inside your piggy bank forever! 🐷 <strong>Total Equity</strong> is all your cookies plus all your toys added together! 👑
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Dashboard Portfolio Stats Summary Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
          {/* Cash */}
          <div className="bg-panel-bg border border-panel-border shadow-sm p-4 rounded-xl flex flex-col justify-between transition-colors duration-200">
            <span className="text-[10px] text-panel-subtext font-mono uppercase tracking-widest block">Available Cash</span>
            <div className="mt-2 flex items-baseline gap-1">
              <span className="text-xl font-black text-panel-heading font-mono">{formatPrice(portfolio.cash)}</span>
            </div>
            <span className="text-[9px] text-panel-subtext/80 mt-1">SIM Sandbox allocation</span>
          </div>

          {/* Unrealized PnL */}
          <div className="bg-panel-bg border border-panel-border shadow-sm p-4 rounded-xl flex flex-col justify-between transition-colors duration-200">
            <span className="text-[10px] text-panel-subtext font-mono uppercase tracking-widest block">Floating Unrealized PnL</span>
            <div className="mt-2 flex items-baseline gap-1">
              <span className={`text-xl font-black font-mono flex items-center ${totalUnrealizedPnL >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                {totalUnrealizedPnL >= 0 ? '+' : '-'}{formatPrice(Math.abs(totalUnrealizedPnL))}
              </span>
              {positions.length > 0 && (
                <span className={`text-[10px] font-semibold ${totalUnrealizedPnL >= 0 ? 'text-emerald-600 dark:text-emerald-500' : 'text-rose-600 dark:text-rose-500'}`}>
                  ({((totalUnrealizedPnL / portfolio.cash) * 100).toFixed(2)}%)
                </span>
              )}
            </div>
            <span className="text-[9px] text-panel-subtext/80 mt-1">{positions.length} active positions</span>
          </div>

          {/* Realized PnL */}
          <div className="bg-panel-bg border border-panel-border shadow-sm p-4 rounded-xl flex flex-col justify-between transition-colors duration-200">
            <span className="text-[10px] text-panel-subtext font-mono uppercase tracking-widest block">Realized Net Returns</span>
            <div className="mt-2 flex items-baseline gap-1">
              <span className={`text-xl font-black font-mono flex items-center ${portfolio.realizedPnL >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                {portfolio.realizedPnL >= 0 ? '+' : '-'}{formatPrice(Math.abs(portfolio.realizedPnL))}
              </span>
            </div>
            <span className="text-[9px] text-panel-subtext/80 mt-1">Calculated since boot</span>
          </div>

          {/* Total Equity */}
          <div className="bg-panel-bg border border-panel-border shadow-sm p-4 rounded-xl flex flex-col justify-between transition-colors duration-200">
            <span className="text-[10px] text-panel-subtext font-mono uppercase tracking-widest block">Total Equity Value</span>
            <div className="mt-2 flex items-baseline gap-1">
              <span className="text-xl font-black text-panel-heading font-mono">{formatPrice(totalEquity)}</span>
            </div>
            <span className="text-[9px] text-panel-subtext/80 mt-1">Cash + Positions value</span>
          </div>

          {/* Total ROI */}
          <div className="bg-panel-bg border border-panel-border shadow-sm p-4 rounded-xl flex flex-col justify-between transition-colors duration-200">
            <span className="text-[10px] text-panel-subtext font-mono uppercase tracking-widest block">Simulation Yield (ROI)</span>
            <div className="mt-2 flex items-baseline gap-1">
              {(() => {
                const yieldPct = ((totalEquity - portfolio.initialBalance) / portfolio.initialBalance) * 100;
                return (
                  <span className={`text-xl font-black font-mono flex items-center ${yieldPct >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                    {yieldPct >= 0 ? <ArrowUpRight size={18} className="mr-0.5" /> : <ArrowDownRight size={18} className="mr-0.5" />}
                    {yieldPct.toFixed(2)}%
                  </span>
                );
              })()}
            </div>
            <span className="text-[9px] text-panel-subtext/80 mt-1">Baseline: {formatPrice(100000)}</span>
          </div>

          {/* Security Guard Mode */}
          <div className={`p-4 rounded-xl border flex flex-col justify-between transition-colors duration-200 ${
            brokerConfig.isLive 
              ? 'bg-rose-950/20 border-rose-800 text-rose-600 dark:text-rose-400' 
              : 'bg-indigo-950/20 border-indigo-905 text-indigo-600 dark:text-indigo-400'
          }`}>
            <span className="text-[10px] uppercase font-mono tracking-wider font-semibold">Risk Port Allocation</span>
            <div className="mt-2">
              <span className="text-sm font-bold font-mono tracking-tight flex items-center gap-1">
                {brokerConfig.isLive ? (
                  <>
                    <ShieldAlert size={14} className="animate-pulse" />
                    LIVE PORT ACTIVE
                  </>
                ) : (
                  <>
                    <Activity size={14} />
                    PAPER SANDBOX
                  </>
                )}
              </span>
            </div>
            <span className="text-[9.5px] text-panel-subtext mt-1">Guardrail Variable Active</span>
          </div>
        </div>

        {/* Responsive Dual-Tier Dashboard Container */}
        <div className="flex flex-col lg:flex-row gap-6 items-start w-full">
          
          {/* A. If we are on one of the SidebarNavigator tabs (Market Watch, Position Ledger, Live Auditing Logs) */}
          {(activeSidebarTab === 'market-watch-section' || activeSidebarTab === 'positions-section' || activeSidebarTab === 'logs-section') && (
            <div className="w-full bg-panel-bg border border-panel-border rounded-xl p-5 shadow-sm transition-colors duration-200 animate-fadeIn">
              <SidebarNavigator 
                tickers={Object.keys(marketData)}
                onAddTicker={onAddTicker}
                brokerConfig={brokerConfig}
                setBrokerConfig={setBrokerConfig}
                selectedTicker={selectedTicker}
                setSelectedTicker={setSelectedTicker}
                automatedTickers={automatedTickers}
                setAutomatedTickers={setAutomatedTickers}
                currentPrices={currentPrices}
                positions={positions}
                alerts={alerts}
                setAlerts={setAlerts}
                alertThreshold={alertThreshold}
                setAlertThreshold={setAlertThreshold}
                alertWindow={alertWindow}
                addLog={addLog}
                executeOrder={executeOrder}
                orders={orders}
                agentLogs={agentLogs}
                setAgentLogs={setAgentLogs}
                portfolio={portfolio}
                handleManualTrade={handleManualTrade}
                onOpenSummaryModal={() => setIsSummaryModalOpen(true)}
                onQuickTrade={(ticker) => {
                  setQuickTradeTicker(ticker);
                  setActiveSidebarTab('cockpit-section');
                  addLog('MASTER_CHIEF', 'SUCCESS', `Quick Trade triggered for ${ticker}. Switching view back to Trading Cockpit.`);
                }}
                marketData={marketData}
                formatPrice={formatPrice}
                eli5Mode={eli5Mode}
                smartStrategyRules={smartStrategyRules}
                setSmartStrategyRules={setSmartStrategyRules}
                realizedPnLByTicker={realizedPnLByTicker}
                activeTab={
                  activeSidebarTab === 'market-watch-section' ? 'market' :
                  activeSidebarTab === 'positions-section' ? 'terminal' :
                  activeSidebarTab === 'logs-section' ? 'health' :
                  undefined
                }
                setActiveTab={(tab) => {
                  if (tab === 'market') setActiveSidebarTab('market-watch-section');
                  else if (tab === 'terminal') setActiveSidebarTab('positions-section');
                  else if (tab === 'health') setActiveSidebarTab('logs-section');
                }}
              />
            </div>
          )}

          {/* ========================================== */}
          {/* 2. MAIN CONTENT PANEL (Trading Cockpit)    */}
          {/* ========================================== */}
          {activeSidebarTab === 'cockpit-section' && (
            <div id="cockpit-section" className="flex-1 min-w-0 w-full space-y-6">

            {/* Workspace Layout Switcher Header */}
            <div className="bg-panel-bg border border-panel-border rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
              <div className="flex items-center gap-2.5">
                <LayoutGrid className="text-indigo-500" size={20} />
                <div>
                  <h3 className="text-sm font-bold text-panel-heading tracking-tight flex items-center gap-1.5">
                    Workspace Cockpit Layout
                    <span className="bg-indigo-100 dark:bg-indigo-950/40 text-indigo-650 dark:text-indigo-400 text-[10px] px-2 py-0.5 rounded-full font-mono font-bold border border-indigo-500/25">
                      New v2.0
                    </span>
                  </h3>
                  <p className="text-[11px] text-panel-subtext mt-0.5">
                    Configure your cockpit layout. Switch between high-depth Single view or 4-way Multi-Chart matrix synchronized monitor.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                <button
                  type="button"
                  onClick={() => setWorkspaceLayout('single')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer border ${
                    workspaceLayout === 'single'
                      ? 'bg-indigo-600 text-white border-indigo-700 shadow-sm'
                      : 'bg-panel-inner-bg text-panel-subtext hover:text-panel-heading hover:bg-panel-border border-panel-border'
                  }`}
                >
                  <Activity size={13} />
                  Single Chart
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setWorkspaceLayout('multi');
                    addLog('DATA_INDICATOR', 'INFO', 'Activated Multi-Chart Workspace Matrix. Loading up to four live synchronized charts simultaneously.');
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer border ${
                    workspaceLayout === 'multi'
                      ? 'bg-indigo-600 text-white border-indigo-700 shadow-sm'
                      : 'bg-panel-inner-bg text-panel-subtext hover:text-panel-heading hover:bg-panel-border border-panel-border'
                  }`}
                >
                  <Grid size={13} />
                  Multi-Chart Matrix
                </button>
                <div className="hidden sm:block h-5 w-[1px] bg-panel-border/60 mx-1"></div>
                <button
                  type="button"
                  onClick={() => {
                    setShowStrategyPanel(!showStrategyPanel);
                    addLog('DATA_INDICATOR', 'INFO', `${showStrategyPanel ? 'Collapsed' : 'Expanded'} the Strategy & Backtest Lab Panel.`);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer border ${
                    showStrategyPanel
                      ? 'bg-emerald-600 text-white border-emerald-700 shadow-sm'
                      : 'bg-panel-inner-bg text-panel-subtext hover:text-panel-heading hover:bg-panel-border border-panel-border'
                  }`}
                >
                  <Sliders size={13} />
                  Strategy Lab
                </button>
                <div className="hidden sm:block h-5 w-[1px] bg-panel-border/60 mx-1"></div>
                <button
                  type="button"
                  id="crosshair-toggle-btn"
                  onClick={() => {
                    const nextVal = !crosshairEnabled;
                    setCrosshairEnabled(nextVal);
                    if (!nextVal) {
                      setCrosshairLabel(null);
                      setCrosshairYPercent(null);
                    }
                    addLog('DATA_INDICATOR', 'INFO', `Synchronized crosshairs ${nextVal ? 'ENABLED 🎯' : 'DISABLED 🔓'} across all workspace charts.`);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer border ${
                    crosshairEnabled
                      ? 'bg-indigo-600 text-white border-indigo-700 shadow-sm'
                      : 'bg-panel-inner-bg text-panel-subtext hover:text-panel-heading hover:bg-panel-border border-panel-border'
                  }`}
                  title="Toggle Workspace-wide Synchronized Crosshairs"
                >
                  <Crosshair size={13} className={crosshairEnabled ? "animate-pulse" : ""} />
                  Sync Crosshair
                </button>
              </div>
            </div>

            {workspaceLayout === 'multi' ? (
              <div className="space-y-6">
                {/* Multi-Chart Matrix Controller Card */}
                <div className="bg-panel-bg border border-panel-border rounded-xl p-5 shadow-sm space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-panel-border pb-3">
                    <div>
                      <h3 className="text-base font-bold text-panel-heading tracking-tight flex items-center gap-1.5">
                        <Grid size={18} className="text-indigo-500 animate-pulse" />
                        Multi-Chart Matrix Monitor
                      </h3>
                      <p className="text-xs text-panel-subtext mt-0.5">
                        Displaying 4 active ticker charts simultaneously for comparative momentum analysis.
                      </p>
                    </div>

                    {/* Matrix Synchronizer Settings Toggle */}
                    <div className="flex items-center gap-4 bg-panel-inner-bg px-3.5 py-1.5 rounded-lg border border-panel-border text-xs">
                      <div className="flex items-center gap-2">
                        <span className="relative inline-flex items-center cursor-pointer select-none">
                          <input 
                            type="checkbox" 
                            checked={syncMultiCharts} 
                            onChange={(e) => {
                              const checked = e.target.checked;
                              setSyncMultiCharts(checked);
                              addLog('DATA_INDICATOR', 'SUCCESS', `Multi-Chart cross-market synchronization ${checked ? 'LOCKED 🔒' : 'UNLOCKED 🔓'}.`);
                            }}
                            className="sr-only peer"
                          />
                          <div className="w-8 h-4 bg-panel-border peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-indigo-600"></div>
                        </span>
                        <span className="font-bold text-panel-heading font-mono text-[10.5px] uppercase">
                          Sync Zoom & Pan 🔒
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Sync Toolbar if Sync mode is enabled */}
                  {syncMultiCharts && (
                    <div className="flex flex-wrap items-center justify-between gap-3 bg-panel-inner-bg p-3 rounded-xl border border-panel-border text-xs transition-all">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[9px] text-panel-subtext font-mono uppercase font-bold mr-1">Global Form:</span>
                        {[
                          { id: 'candlestick', label: '🕯️ Candles' },
                          { id: 'line', label: '📈 Line' },
                          { id: 'area', label: 'Area' },
                          { id: 'bar', label: 'Bars' }
                        ].map((type) => (
                          <button
                            key={type.id}
                            type="button"
                            onClick={() => setChartType(type.id as any)}
                            className={`px-2 py-0.5 rounded text-[10px] font-bold transition cursor-pointer ${
                              chartType === type.id
                                ? 'bg-indigo-600/15 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30'
                                : 'text-panel-subtext hover:text-panel-heading hover:bg-panel-border border border-transparent'
                            }`}
                          >
                            {type.label}
                          </button>
                        ))}
                      </div>

                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[9px] text-panel-subtext font-mono uppercase font-bold mr-1">Global Overlays:</span>
                        <button
                          type="button"
                          onClick={() => setShowSMA(!showSMA)}
                          className={`px-2 py-0.5 rounded text-[10px] font-medium transition cursor-pointer ${
                            showSMA 
                              ? 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-900/40' 
                              : 'text-panel-subtext hover:bg-panel-border border border-transparent'
                          }`}
                        >
                          SMA
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowEMA(!showEMA)}
                          className={`px-2 py-0.5 rounded text-[10px] font-medium transition cursor-pointer ${
                            showEMA 
                              ? 'bg-amber-100 dark:bg-amber-950/40 text-amber-600 dark:text-amber-450 border border-amber-300 dark:border-amber-900/40' 
                              : 'text-panel-subtext hover:bg-panel-border border border-transparent'
                          }`}
                        >
                          EMA
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowBB(!showBB)}
                          className={`px-2 py-0.5 rounded text-[10px] font-medium transition cursor-pointer ${
                            showBB 
                              ? 'bg-indigo-100 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-300 dark:border-indigo-900/40' 
                              : 'text-panel-subtext hover:bg-panel-border border border-transparent'
                          }`}
                        >
                          B-Bands
                        </button>
                      </div>

                      {/* Global zoom & pan status info in bar */}
                      <div className="font-mono text-[9.5px] text-panel-subtext">
                        Zoom: <span className="text-panel-heading font-bold">{zoomCount}</span> | Pan: <span className="text-panel-heading font-bold">{panOffset === 0 ? '🟢 Live' : `🕒 -${panOffset}`}</span>
                      </div>
                    </div>
                  )}

                  {/* The 2x2 Grid Layout */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {multiChartTickers.map((ticker, index) => {
                      const pointsForCell = getSlicedChartPointsForTicker(ticker, index);
                      const price = currentPrices[ticker] || TICKER_INFO[ticker]?.initPrice || 100;
                      const hasPosition = positions.find(p => p.ticker === ticker);
                      const name = TICKER_INFO[ticker]?.name || POPULAR_NAMES[ticker] || `${ticker} Stock`;
                      
                      // Resolve active styling parameters for this slot
                      const activeChartType = syncMultiCharts ? chartType : (cellChartTypes[index] ?? 'candlestick');
                      const activeShowSMA = syncMultiCharts ? showSMA : (cellOverlays[index]?.showSMA ?? true);
                      const activeShowEMA = syncMultiCharts ? showEMA : (cellOverlays[index]?.showEMA ?? false);
                      const activeShowBB = syncMultiCharts ? showBB : (cellOverlays[index]?.showBB ?? false);
                      const activeShowInfinitron = syncMultiCharts ? showInfinitron : (cellOverlays[index]?.showInfinitron ?? true);
                      const activeZoom = syncMultiCharts ? zoomCount : (cellZooms[index] ?? 45);
                      const activePan = syncMultiCharts ? panOffset : (cellPans[index] ?? 0);

                      const gestureHandlers = createCellPointerHandlers(index, ticker);
                      const handleWheelCell = createCellWheelHandler(index);

                      return (
                        <div 
                          key={`cell-${index}-${ticker}`} 
                          className={`bg-panel-inner-bg/20 border rounded-xl p-3.5 space-y-3 transition-all duration-200 ${
                            selectedTicker === ticker 
                              ? 'border-indigo-500 shadow-md ring-1 ring-indigo-500/20' 
                              : 'border-panel-border hover:border-panel-border/85'
                          }`}
                        >
                          {/* Top controls header of slot */}
                          <div className="flex items-center justify-between gap-1">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <select
                                value={ticker}
                                onChange={(e) => handleSelectSlotTicker(index, e.target.value)}
                                className="bg-panel-inner-bg text-panel-heading border border-panel-border rounded px-1.5 py-0.5 text-xs font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                              >
                                {Object.keys(TICKER_INFO).map((tk) => (
                                  <option key={tk} value={tk}>{tk}</option>
                                ))}
                              </select>
                              <span className="text-[10px] text-panel-subtext truncate max-w-[80px]" title={name}>
                                {name}
                              </span>
                            </div>

                            <div className="flex items-center gap-2">
                              <span className="text-[11.5px] font-mono text-panel-heading font-extrabold">
                                {formatPrice(price)}
                              </span>
                              <button
                                type="button"
                                onClick={() => setSelectedTicker(ticker)}
                                className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase transition cursor-pointer ${
                                  selectedTicker === ticker
                                    ? 'bg-indigo-600 text-white'
                                    : 'bg-panel-inner-bg text-panel-subtext hover:text-panel-heading border border-panel-border'
                                }`}
                                title="Set as primary focused stock"
                              >
                                {selectedTicker === ticker ? '★ Focused' : 'Focus'}
                              </button>
                            </div>
                          </div>

                          {/* Quick Execution Trade buttons inside slot */}
                          <div className="flex items-center justify-between gap-2 bg-panel-inner-bg p-1.5 rounded border border-panel-border/55">
                            <div className="text-[9px] font-mono flex items-center gap-1 text-panel-subtext">
                              {hasPosition ? (
                                <span className="text-emerald-500 font-bold">Qty: {hasPosition.quantity}</span>
                              ) : (
                                <span>No Pos</span>
                              )}
                            </div>

                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  // Quick 10% Cash buy size
                                  const qty = Math.floor((portfolio.cash * 0.1) / price) || 1;
                                  executeOrder(ticker, 'BUY', price, qty, `Quick Multi-chart grid order.`);
                                }}
                                className="px-2 py-0.5 rounded text-[9.5px] font-bold bg-emerald-600 hover:bg-emerald-550 text-white transition shadow-sm cursor-pointer"
                              >
                                BUY
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  const pos = positions.find(p => p.ticker === ticker);
                                  if (!pos) {
                                    alert(`No position found in ${ticker} to sell.`);
                                    return;
                                  }
                                  executeOrder(ticker, 'SELL', price, pos.quantity, `Quick Multi-chart grid liquidate.`);
                                }}
                                disabled={!hasPosition}
                                className="px-2 py-0.5 rounded text-[9.5px] font-bold bg-rose-600 hover:bg-rose-550 text-white transition disabled:opacity-30 disabled:pointer-events-none shadow-sm cursor-pointer"
                              >
                                SELL
                              </button>
                            </div>
                          </div>

                          {/* Local Independent Settings (only if NOT synchronized) */}
                          {!syncMultiCharts && (
                            <div className="flex items-center justify-between gap-2 text-[9.5px] border-b border-panel-border/30 pb-1.5">
                              {/* Form toggler */}
                              <div className="flex gap-1">
                                {(['candlestick', 'line', 'area'] as const).map(tf => (
                                  <button
                                    key={tf}
                                    type="button"
                                    onClick={() => setCellChartTypes(prev => ({ ...prev, [index]: tf }))}
                                    className={`px-1 rounded text-[8.5px] transition cursor-pointer ${
                                      activeChartType === tf 
                                        ? 'bg-panel-border text-indigo-500 font-bold' 
                                        : 'text-panel-subtext hover:bg-panel-inner-bg'
                                    }`}
                                  >
                                    {tf === 'candlestick' ? '🕯️' : tf === 'line' ? '📈' : 'Area'}
                                  </button>
                                ))}
                              </div>

                              {/* Overlays toggler */}
                              <div className="flex gap-1 font-mono">
                                <button
                                  type="button"
                                  onClick={() => setCellOverlays(prev => ({
                                    ...prev,
                                    [index]: { ...prev[index], showSMA: !activeShowSMA }
                                  }))}
                                  className={`px-1.5 py-0.1 border rounded text-[8px] cursor-pointer ${activeShowSMA ? 'border-emerald-500 text-emerald-500 bg-emerald-950/15 font-bold' : 'border-transparent text-panel-subtext'}`}
                                >
                                  SMA
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setCellOverlays(prev => ({
                                    ...prev,
                                    [index]: { ...prev[index], showEMA: !activeShowEMA }
                                  }))}
                                  className={`px-1.5 py-0.1 border rounded text-[8px] cursor-pointer ${activeShowEMA ? 'border-amber-500 text-amber-500 bg-amber-950/15 font-bold' : 'border-transparent text-panel-subtext'}`}
                                >
                                  EMA
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setCellOverlays(prev => ({
                                    ...prev,
                                    [index]: { ...prev[index], showBB: !activeShowBB }
                                  }))}
                                  className={`px-1.5 py-0.1 border rounded text-[8px] cursor-pointer ${activeShowBB ? 'border-indigo-500 text-indigo-500 bg-indigo-950/15 font-bold' : 'border-transparent text-panel-subtext'}`}
                                >
                                  BB
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setCellOverlays(prev => ({
                                    ...prev,
                                    [index]: { ...prev[index], showInfinitron: !activeShowInfinitron }
                                  }))}
                                  className={`px-1.5 py-0.1 border rounded text-[8px] cursor-pointer ${activeShowInfinitron ? 'border-rose-500 text-rose-500 bg-rose-950/15 font-bold' : 'border-transparent text-panel-subtext'}`}
                                >
                                  INF
                                </button>
                              </div>
                            </div>
                          )}

                          {/* Chart Container */}
                          <div 
                            className="relative-chart-container h-[180px] w-full cursor-col-resize select-none touch-none bg-panel-inner-bg/35 rounded-lg border border-panel-border/30 p-1 relative"
                            onWheel={handleWheelCell}
                            onPointerDown={gestureHandlers.onPointerDown}
                            onPointerMove={gestureHandlers.onPointerMove}
                            onPointerUp={gestureHandlers.onPointerUp}
                            onPointerLeave={gestureHandlers.onPointerLeave}
                          >
                            {crosshairEnabled && crosshairYPercent !== null && (
                              <div 
                                className="absolute left-0 right-0 h-[1px] border-t border-dashed border-indigo-500/60 pointer-events-none z-30"
                                style={{ top: `${crosshairYPercent}%` }}
                              />
                            )}
                            {pointsForCell.length === 0 ? (
                              <div className="h-full flex items-center justify-center text-panel-subtext font-mono text-[9.5px]">
                                <RefreshCw className="animate-spin mr-1.5" size={12} /> INITIALIZING MATRIX...
                              </div>
                            ) : (
                              <ResponsiveContainer width="100%" height="100%">
                                <ComposedChart 
                                  data={pointsForCell} 
                                  margin={{ top: 5, right: 5, left: 5, bottom: 0 }}
                                  onMouseMove={handleChartMouseMove}
                                  onMouseLeave={handleChartMouseLeave}
                                >
                                  <CartesianGrid strokeDasharray="3 3" stroke="var(--grid-line)" horizontal={showGridH} vertical={showGridV} />
                                  <XAxis dataKey="time" stroke="var(--panel-subtext)" fontSize={8} minTickGap={30} />
                                  <YAxis stroke="var(--panel-subtext)" fontSize={8} domain={['auto', 'auto']} tickFormatter={(v) => `$${v}`} orientation={priceScaleAxis} />
                                  <Tooltip 
                                    contentStyle={{ backgroundColor: 'var(--panel-bg)', borderColor: 'var(--panel-border)', borderRadius: '6px', fontSize: '10px', color: 'var(--canvas-text)', padding: '4px' }}
                                    labelStyle={{ color: 'var(--panel-subtext)', fontWeight: 'bold' }}
                                  />
                                  {crosshairEnabled && crosshairLabel && (
                                    <ReferenceLine x={crosshairLabel} stroke="rgba(129, 140, 248, 0.65)" strokeWidth={1} strokeDasharray="3 3" />
                                  )}

                                  {activeChartType === 'line' && (
                                    <Line type="monotone" dataKey="close" stroke="#818cf8" strokeWidth={1.8} dot={false} name="Price" />
                                  )}

                                  {activeChartType === 'area' && (
                                    <Area type="monotone" dataKey="close" stroke="#818cf8" strokeWidth={1.5} fill="url(#colorPrice)" name="Price" />
                                  )}

                                  {activeChartType === 'bar' && (
                                    <Bar dataKey="close" name="Price">
                                      {pointsForCell.map((entry, bIdx) => {
                                        const isUp = entry.close >= entry.open;
                                        return <Cell key={`bar-cell-${index}-${bIdx}`} fill={isUp ? '#10b981' : '#f43f5e'} opacity={0.7} />;
                                      })}
                                    </Bar>
                                  )}

                                  {activeChartType === 'candlestick' && (
                                    <Bar 
                                      dataKey="close" 
                                      name="Candle"
                                      shape={(barProps: any) => {
                                        const { x, width, payload, yAxis } = barProps;
                                        if (!payload) return null;
                                        return (
                                          <Candlestick 
                                            x={x} 
                                            width={width} 
                                            open={payload.open} 
                                            close={payload.close} 
                                            high={payload.high} 
                                            low={payload.low} 
                                            yAxis={yAxis} 
                                            payload={payload}
                                          />
                                        );
                                      }}
                                    />
                                  )}

                                  {/* Custom Overlays */}
                                  {activeShowSMA && (
                                    <Line type="monotone" dataKey="indicators.smaShort" stroke="#10b981" strokeWidth={1} dot={false} name="SMA (Short)" strokeDasharray="1 1" />
                                  )}
                                  {activeShowSMA && (
                                    <Line type="monotone" dataKey="indicators.smaLong" stroke="#059669" strokeWidth={1.2} dot={false} name="SMA (Long)" />
                                  )}
                                  {activeShowEMA && (
                                    <Line type="monotone" dataKey="indicators.ema" stroke="#f59e0b" strokeWidth={1} dot={false} name="EMA" />
                                  )}
                                  {activeShowBB && (
                                    <Line type="monotone" dataKey="indicators.bollingerBands.upper" stroke="#6366f1" strokeWidth={0.8} dot={false} name="BB Up" opacity={0.5} />
                                  )}
                                  {activeShowBB && (
                                    <Line type="monotone" dataKey="indicators.bollingerBands.lower" stroke="#6366f1" strokeWidth={0.8} dot={false} name="BB Low" opacity={0.5} />
                                  )}

                                  <InfinitronPivotsOverlay
                                    fullCandles={marketData[ticker] || []}
                                    visibleCandles={pointsForCell}
                                    show={activeShowInfinitron}
                                  />

                                  <Scatter dataKey="buySignalPoint" fill="#10b981" shape="triangle" legendType="none" />
                                  <Scatter dataKey="sellSignalPoint" fill="#f43f5e" shape="circle" legendType="none" />
                                </ComposedChart>
                              </ResponsiveContainer>
                            )}
                          </div>

                          {/* Zoom & Pan Console inside cell (Only if independent) */}
                          {!syncMultiCharts && (
                            <div className="flex items-center justify-between text-[10px] bg-panel-inner-bg p-1.5 rounded border border-panel-border/30">
                              <div className="flex items-center gap-1">
                                <span className="font-mono text-panel-subtext text-[8px] uppercase">Zoom:</span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setCellZooms(prev => ({ ...prev, [index]: Math.min(100, (cellZooms[index] ?? 45) + 5) }));
                                  }}
                                  className="px-1 border border-panel-border rounded hover:bg-panel-border text-[9px] font-bold cursor-pointer"
                                >
                                  -
                                </button>
                                <span className="font-mono text-[9px] font-bold">{activeZoom}</span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setCellZooms(prev => ({ ...prev, [index]: Math.max(15, (cellZooms[index] ?? 45) - 5) }));
                                  }}
                                  className="px-1 border border-panel-border rounded hover:bg-panel-border text-[9px] font-bold cursor-pointer"
                                >
                                  +
                                </button>
                              </div>

                              <div className="flex items-center gap-1 font-mono">
                                <span className="text-panel-subtext text-[8px] uppercase">Pan:</span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const raw = marketData[ticker] || [];
                                    const maxP = Math.max(0, raw.length - activeZoom);
                                    setCellPans(prev => ({ ...prev, [index]: Math.min(maxP, (cellPans[index] ?? 0) + 5) }));
                                  }}
                                  className="px-1 border border-panel-border rounded hover:bg-panel-border text-[8.5px] cursor-pointer"
                                >
                                  ◀
                                </button>
                                <span className="text-[8px] truncate max-w-[60px]">
                                  {activePan === 0 ? 'Live' : `-${activePan}`}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setCellPans(prev => ({ ...prev, [index]: Math.max(0, (cellPans[index] ?? 0) - 5) }));
                                  }}
                                  className="px-1 border border-panel-border rounded hover:bg-panel-border text-[8.5px] cursor-pointer"
                                >
                                  ▶
                                </button>
                              </div>
                            </div>
                          )}

                          {/* ELI5 helper in grid card */}
                          {eli5Mode && (
                            <p className="text-[8.5px] text-amber-600 dark:text-amber-450 leading-tight">
                              🧸 <em>ELI5: Showing {ticker} mini charts 📊 side-by-side! Press BUY or SELL to trade instantly or set as Focused to check logs!</em>
                            </p>
                          )}

                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : (
              /* Ticker Interactive Chart Card */
              <div className="bg-panel-bg border border-panel-border rounded-xl p-5 shadow-sm space-y-5 transition-colors duration-200">
                
                {/* Header Title with Active Metadata */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-panel-border pb-4">
                  <div>
                    <h3 className="text-base font-bold text-panel-heading tracking-tight flex items-center gap-1.5">
                      <Activity size={18} className="text-indigo-500 animate-pulse" />
                      Interactive Real-Time Ticker Chart
                    </h3>
                    <p className="text-xs text-panel-subtext mt-0.5">
                      Analyzing <span className="font-bold text-panel-heading">{selectedTicker}</span> ({TICKER_INFO[selectedTicker]?.name || POPULAR_NAMES[selectedTicker] || `${selectedTicker} Common Stock`}). Touch-drag to pan history, scroll mouse-wheel to zoom.
                    </p>
                  </div>
                  
                  {/* Active stock metrics row & alert analytics button */}
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setIsSummaryModalOpen(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-650/15 hover:bg-indigo-600/20 text-indigo-600 dark:text-indigo-400 border border-indigo-500/25 text-xs font-bold transition cursor-pointer shadow-sm"
                    >
                      <Bell size={13} className="text-indigo-500 animate-pulse" />
                      Alert Analytics
                    </button>

                    <div className="flex items-center gap-3 font-mono text-xs text-panel-heading bg-panel-inner-bg px-3 py-1.5 rounded-lg border border-panel-border">
                      <div className="leading-none border-r border-panel-border pr-3">
                        <span className="text-[9px] text-panel-subtext uppercase block">Last Trade</span>
                        <span className="font-bold font-mono text-panel-heading">${(currentPrices[selectedTicker] || 0).toFixed(2)}</span>
                      </div>
                      <div className="leading-none">
                        <span className="text-[9px] text-panel-subtext uppercase block">Volatility (ATR)</span>
                        <span className="font-bold text-indigo-500">{((TICKER_INFO[selectedTicker]?.volatility || 0.002) * 100).toFixed(2)}%</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Comprehensive Toolbar Option Grid */}
                <div className="flex flex-wrap items-center justify-between gap-4 bg-panel-inner-bg p-3 rounded-xl border border-panel-border text-xs w-full transition-colors">
                  
                  {/* Interval Toggles */}
                  <div className="flex items-center gap-1 flex-wrap">
                    <span className="text-[9px] text-panel-subtext font-mono uppercase font-bold mr-1.5">Interval:</span>
                    {(['1m', '5m', '15m', '1h', '1d'] as const).map((tf) => (
                      <button
                        key={tf}
                        type="button"
                        onClick={() => {
                          setTimeframe(tf);
                          setPanOffset(0);
                        }}
                        className={`px-2.5 py-1 rounded text-[10.5px] font-mono font-bold transition cursor-pointer ${
                          timeframe === tf
                            ? 'bg-indigo-600 text-white shadow shadow-indigo-950/40'
                            : 'text-panel-subtext hover:text-panel-heading hover:bg-panel-border'
                        }`}
                      >
                        {tf}
                      </button>
                    ))}
                  </div>

                  {/* Form Selection */}
                  <div className="flex items-center gap-1 flex-wrap">
                    <span className="text-[9px] text-panel-subtext font-mono uppercase font-bold mr-1.5">Form:</span>
                    {[
                      { id: 'candlestick', label: '🕯️ Candles' },
                      { id: 'line', label: '📈 Line' },
                      { id: 'area', label: 'Area' },
                      { id: 'bar', label: 'Bars' }
                    ].map((type) => (
                      <button
                        key={type.id}
                        type="button"
                        onClick={() => setChartType(type.id as any)}
                        className={`px-2 py-1 rounded text-[10.5px] font-bold transition cursor-pointer ${
                          chartType === type.id
                            ? 'bg-indigo-600/15 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30'
                            : 'text-panel-subtext hover:text-panel-heading hover:bg-panel-border border border-transparent'
                        }`}
                      >
                        {type.label}
                      </button>
                    ))}
                  </div>

                  {/* Price Axis & Grid customization */}
                  <div className="flex items-center gap-1 flex-wrap">
                    <span className="text-[9px] text-panel-subtext font-mono uppercase font-bold mr-1">Axis:</span>
                    <button
                      type="button"
                      onClick={() => setPriceScaleAxis(priceScaleAxis === 'right' ? 'left' : 'right')}
                      className="px-2 py-1 rounded text-[10.5px] font-bold transition cursor-pointer bg-panel-bg border border-panel-border text-panel-heading hover:bg-panel-border"
                    >
                      {priceScaleAxis === 'right' ? 'Right side' : 'Left side'}
                    </button>
                    
                    <span className="text-[9px] text-panel-subtext font-mono uppercase font-bold ml-1.5 mr-1">Grid:</span>
                    <button
                      type="button"
                      onClick={() => setShowGridH(!showGridH)}
                      className={`px-2 py-1 rounded text-[10.5px] font-bold transition cursor-pointer ${
                        showGridH 
                          ? 'bg-panel-bg text-indigo-650 dark:text-indigo-450 border border-indigo-500/20 shadow-sm' 
                          : 'text-panel-subtext opacity-50 hover:opacity-100 border border-transparent'
                      }`}
                    >
                      H-Grid
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowGridV(!showGridV)}
                      className={`px-2 py-1 rounded text-[10.5px] font-bold transition cursor-pointer ${
                        showGridV 
                          ? 'bg-panel-bg text-indigo-650 dark:text-indigo-450 border border-indigo-500/20 shadow-sm' 
                          : 'text-panel-subtext opacity-50 hover:opacity-100 border border-transparent'
                      }`}
                    >
                      V-Grid
                    </button>
                  </div>

                  {/* Indicators overlays */}
                  <div className="flex items-center gap-1 flex-wrap">
                    <span className="text-[9px] text-panel-subtext font-mono uppercase font-bold mr-1.5">Overlays:</span>
                    <button
                      type="button"
                      onClick={() => setShowSMA(!showSMA)}
                      className={`px-2 py-1 rounded text-[10.5px] font-medium transition cursor-pointer ${
                        showSMA 
                          ? 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-900/40' 
                          : 'text-panel-subtext hover:bg-panel-border border border-transparent'
                      }`}
                    >
                      SMA
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowEMA(!showEMA)}
                      className={`px-2 py-1 rounded text-[10.5px] font-medium transition cursor-pointer ${
                        showEMA 
                          ? 'bg-amber-100 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-300 dark:border-amber-900/40' 
                          : 'text-panel-subtext hover:bg-panel-border border border-transparent'
                      }`}
                    >
                      EMA
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowBB(!showBB)}
                      className={`px-2 py-1 rounded text-[10.5px] font-medium transition cursor-pointer ${
                        showBB 
                          ? 'bg-indigo-100 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-300 dark:border-indigo-900/40' 
                          : 'text-panel-subtext hover:bg-panel-border border border-transparent'
                      }`}
                    >
                      B-Bands
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowInfinitron(!showInfinitron)}
                      className={`px-2 py-1 rounded text-[10.5px] font-medium transition cursor-pointer ${
                        showInfinitron 
                          ? 'bg-rose-100 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-300 dark:border-rose-900/40 font-bold' 
                          : 'text-panel-subtext hover:bg-panel-border border border-transparent'
                      }`}
                    >
                      Infinitron Pivots
                    </button>
                  </div>

                  {/* Sub-Chart Panels Selector */}
                  <div className="flex flex-col gap-2 p-2.5 bg-panel-inner-bg/40 rounded-xl border border-panel-border/50">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-panel-heading font-mono uppercase font-bold">📊 Active Data Charts:</span>
                      </div>
                      <div className="flex items-center gap-1 bg-panel-bg p-0.5 rounded border border-panel-border">
                        <span className="text-[8px] text-panel-subtext font-mono uppercase px-1">Size:</span>
                        {(['compact', 'balanced', 'large'] as const).map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => setSubChartHeightPreset(preset)}
                            className={`px-1.5 py-0.5 rounded text-[9px] font-semibold transition uppercase cursor-pointer ${
                              subChartHeightPreset === preset
                                ? 'bg-indigo-500 text-white'
                                : 'text-panel-subtext hover:text-panel-heading hover:bg-panel-border'
                            }`}
                          >
                            {preset}
                          </button>
                        ))}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <button
                        type="button"
                        onClick={() => setShowVolume(!showVolume)}
                        className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition flex items-center gap-1 cursor-pointer ${
                          showVolume
                            ? 'bg-sky-50 dark:bg-sky-950/30 text-sky-600 dark:text-sky-400 border-sky-300 dark:border-sky-900/40'
                            : 'bg-panel-bg text-panel-subtext border-panel-border hover:bg-panel-border'
                        }`}
                      >
                        <span>📊 Volume</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setShowRSI(!showRSI)}
                        className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition flex items-center gap-1 cursor-pointer ${
                          showRSI
                            ? 'bg-purple-50 dark:bg-purple-950/30 text-purple-600 dark:text-purple-400 border-purple-300 dark:border-purple-900/40'
                            : 'bg-panel-bg text-panel-subtext border-panel-border hover:bg-panel-border'
                        }`}
                      >
                        <span>🧭 RSI Oscillator</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setShowMACD(!showMACD)}
                        className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition flex items-center gap-1 cursor-pointer ${
                          showMACD
                            ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border-emerald-300 dark:border-emerald-900/40'
                            : 'bg-panel-bg text-panel-subtext border-panel-border hover:bg-panel-border'
                        }`}
                      >
                        <span>📉 MACD Oscillator</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setShowStochastic(!showStochastic)}
                        className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition flex items-center gap-1 cursor-pointer ${
                          showStochastic
                            ? 'bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 border-amber-300 dark:border-amber-900/40'
                            : 'bg-panel-bg text-panel-subtext border-panel-border hover:bg-panel-border'
                        }`}
                      >
                        <span>⚡ Stochastic Oscillator</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setShowATR(!showATR)}
                        className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition flex items-center gap-1 cursor-pointer ${
                          showATR
                            ? 'bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 border-rose-300 dark:border-rose-900/40'
                            : 'bg-panel-bg text-panel-subtext border-panel-border hover:bg-panel-border'
                        }`}
                      >
                        <span>🌊 ATR Volatility</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Chart Core Rendering Block */}
                {apiError ? (
                  <div className="h-[380px] flex flex-col items-center justify-center bg-rose-950/15 border border-rose-500/25 rounded-2xl p-6 text-center max-w-xl mx-auto my-4 font-sans">
                    <div className="p-3 bg-rose-500/10 text-rose-500 rounded-full mb-3">
                      <AlertOctagon size={24} />
                    </div>
                    <h3 className="text-sm font-bold text-rose-400 uppercase tracking-wide mb-1.5 font-mono">
                      Market Data Feed Connection Failed
                    </h3>
                    <p className="text-xs text-panel-subtext mb-4 leading-relaxed max-w-md">
                      {apiError}
                    </p>
                    <div className="text-[10px] bg-panel-inner-bg p-3 rounded-lg border border-panel-border text-panel-subtext text-left font-mono max-w-md w-full space-y-1">
                      <div className="text-panel-heading font-semibold uppercase mb-1">How to fix this:</div>
                      <div>1. Open the <span className="text-indigo-400 font-bold">Secrets panel</span> in the AI Studio settings.</div>
                      <div>2. Set <span className="text-indigo-400">ALPACA_API_KEY_ID</span> to your Alpaca Client ID.</div>
                      <div>3. Set <span className="text-indigo-400">ALPACA_API_SECRET_KEY</span> to your Alpaca Secret.</div>
                    </div>
                  </div>
                ) : chartPoints.length === 0 ? (
                  <div className="h-[380px] flex items-center justify-center text-panel-subtext font-mono text-xs">
                    <RefreshCw className="animate-spin mr-2" size={14} /> LOADING DATA STREAMS...
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Primary Overlay Price Chart (With custom touch gestures) */}
                    <div 
                      className="relative-chart-container relative h-[280px] w-full cursor-col-resize select-none touch-none bg-panel-inner-bg/30 p-2 rounded-xl border border-panel-border/45"
                      onWheel={handleWheel}
                      onPointerDown={handlePointerDown}
                      onPointerMove={handlePointerMove}
                      onPointerUp={handlePointerUp}
                      onPointerLeave={handlePointerUp}
                    >
                      {crosshairEnabled && crosshairYPercent !== null && (
                        <div 
                          className="absolute left-0 right-0 h-[1px] border-t border-dashed border-indigo-500/60 pointer-events-none z-30"
                          style={{ top: `${crosshairYPercent}%` }}
                        />
                      )}
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart 
                          data={slicedChartPoints} 
                          margin={{ top: 10, right: 10, left: 10, bottom: 0 }}
                          onMouseMove={handleChartMouseMove}
                          onMouseLeave={handleChartMouseLeave}
                        >
                          <defs>
                            <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#818cf8" stopOpacity={0.25}/>
                              <stop offset="95%" stopColor="#818cf8" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--grid-line)" horizontal={showGridH} vertical={showGridV} />
                          <XAxis dataKey="time" stroke="var(--panel-subtext)" fontSize={10} minTickGap={25} />
                          <YAxis stroke="var(--panel-subtext)" fontSize={10} domain={['auto', 'auto']} tickFormatter={(v) => `$${v}`} orientation={priceScaleAxis} />
                          <Tooltip 
                            contentStyle={{ backgroundColor: 'var(--panel-bg)', borderColor: 'var(--panel-border)', borderRadius: '8px', fontSize: '11px', color: 'var(--canvas-text)' }}
                            labelStyle={{ color: 'var(--panel-subtext)', fontWeight: 'bold' }}
                          />
                          {crosshairEnabled && crosshairLabel && (
                            <ReferenceLine x={crosshairLabel} stroke="rgba(129, 140, 248, 0.65)" strokeWidth={1} strokeDasharray="3 3" />
                          )}

                          {/* Chart styles mappings */}
                          {chartType === 'line' && (
                            <Line type="monotone" dataKey="close" stroke="#818cf8" strokeWidth={2.5} dot={false} name="Close Price" />
                          )}

                          {chartType === 'area' && (
                            <Area type="monotone" dataKey="close" stroke="#818cf8" strokeWidth={2} fill="url(#colorPrice)" name="Close Price" />
                          )}

                          {chartType === 'bar' && (
                            <Bar dataKey="close" name="Close Price">
                              {slicedChartPoints.map((entry, index) => {
                                const isUp = entry.close >= entry.open;
                                return <Cell key={`bar-cell-${index}`} fill={isUp ? '#10b981' : '#f43f5e'} opacity={0.8} />;
                              })}
                            </Bar>
                          )}

                          {(chartType === 'candlestick' || chartType === 'heikin-ashi') && (
                            <Bar 
                              dataKey="close" 
                              name="Candle Body"
                              shape={(barProps: any) => {
                                const { x, width, payload, yAxis } = barProps;
                                if (!payload) return null;
                                return (
                                  <Candlestick 
                                    x={x} 
                                    width={width} 
                                    open={payload.open} 
                                    close={payload.close} 
                                    high={payload.high} 
                                    low={payload.low} 
                                    yAxis={yAxis} 
                                    payload={payload}
                                    isHeikinAshi={chartType === 'heikin-ashi'}
                                  />
                                );
                              }}
                            />
                          )}
                          
                          {/* Custom Indicators */}
                          {showSMA && (
                            <Line type="monotone" dataKey="indicators.smaShort" stroke="#10b981" strokeWidth={1.2} dot={false} name="SMA (Short)" strokeDasharray="2 2" />
                          )}
                          {showSMA && (
                            <Line type="monotone" dataKey="indicators.smaLong" stroke="#059669" strokeWidth={1.5} dot={false} name="SMA (Long)" />
                          )}
                          {showEMA && (
                            <Line type="monotone" dataKey="indicators.ema" stroke="#f59e0b" strokeWidth={1.2} dot={false} name="EMA (Short)" />
                          )}
                          {showBB && (
                            <Line type="monotone" dataKey="indicators.bollingerBands.upper" stroke="#6366f1" strokeWidth={1} dot={false} name="BB Upper" opacity={0.6} />
                          )}
                          {showBB && (
                            <Line type="monotone" dataKey="indicators.bollingerBands.lower" stroke="#6366f1" strokeWidth={1} dot={false} name="BB Lower" opacity={0.6} />
                          )}

                          <InfinitronPivotsOverlay
                            fullCandles={marketData[selectedTicker] || []}
                            visibleCandles={slicedChartPoints}
                            show={showInfinitron}
                          />

                          {/* Signals markers overlay */}
                          <Scatter dataKey="buySignalPoint" fill="#10b981" shape="triangle" legendType="none" name="Automated BUY" />
                          <Scatter dataKey="sellSignalPoint" fill="#f43f5e" shape="circle" legendType="none" name="Automated SELL" />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>

                    {/* 🎮 Premium Chart Zoom & Navigation Console */}
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-panel-inner-bg p-3 rounded-xl border border-panel-border text-xs">
                      {/* Zoom Controller */}
                      <div className="flex items-center gap-2.5 w-full sm:w-auto">
                        <span className="text-panel-subtext font-mono text-[9.5px] uppercase font-bold">
                          🔍 Zoom Bars:
                        </span>
                        <button
                          type="button"
                          onClick={() => setZoomCount(prev => Math.min(100, prev + 5))}
                          disabled={zoomCount >= 100}
                          className="bg-panel-bg hover:bg-panel-border border border-panel-border text-panel-heading font-bold px-2 py-0.5 rounded transition disabled:opacity-30 cursor-pointer text-xs"
                        >
                          -
                        </button>
                        <span className="font-mono text-panel-heading font-bold bg-panel-bg px-2 py-0.5 border border-panel-border rounded text-[11px] min-w-[50px] text-center">
                          {zoomCount}
                        </span>
                        <button
                          type="button"
                          onClick={() => setZoomCount(prev => Math.max(15, prev - 5))}
                          disabled={zoomCount <= 15}
                          className="bg-panel-bg hover:bg-panel-border border border-panel-border text-panel-heading font-bold px-2 py-0.5 rounded transition disabled:opacity-30 cursor-pointer text-xs"
                        >
                          +
                        </button>
                        <input
                          type="range"
                          min={15}
                          max={100}
                          step={5}
                          value={zoomCount}
                          onChange={(e) => setZoomCount(parseInt(e.target.value))}
                          className="w-24 sm:w-32 accent-indigo-500 bg-panel-border h-1.5 rounded cursor-pointer"
                        />
                      </div>

                      {/* Scrolling Pan Controller */}
                      <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
                        <span className="text-panel-subtext font-mono text-[9.5px] uppercase font-bold">
                          🕒 History:
                        </span>
                        <button
                          type="button"
                          onClick={() => setPanOffset(prev => Math.min(maxPan, prev + 5))}
                          disabled={safePan >= maxPan}
                          className="bg-panel-bg hover:bg-panel-border border border-panel-border text-panel-heading font-bold px-2 py-0.5 rounded transition disabled:opacity-30 cursor-pointer text-xs"
                        >
                          ◀ Back
                        </button>
                        <span className="font-mono text-panel-heading text-[11px] bg-panel-bg px-2 py-0.5 border border-panel-border rounded text-center min-w-[100px]">
                          {safePan === 0 ? '🟢 Live present' : `🕒 -${safePan} bars`}
                        </span>
                        <button
                          type="button"
                          onClick={() => setPanOffset(prev => Math.max(0, prev - 5))}
                          disabled={safePan <= 0}
                          className="bg-panel-bg hover:bg-panel-border border border-panel-border text-panel-heading font-bold px-2 py-0.5 rounded transition disabled:opacity-30 cursor-pointer text-xs"
                        >
                          Next ▶
                        </button>
                        {safePan > 0 && (
                          <button
                            type="button"
                            onClick={() => setPanOffset(0)}
                            className="bg-emerald-100 dark:bg-emerald-950/60 hover:bg-emerald-250 text-emerald-600 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-900 font-mono text-[9px] font-bold px-2 py-0.5 rounded uppercase tracking-wider transition cursor-pointer"
                          >
                            Go Live 🟢
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Secondary Customizable Charts Area */}
                    {(() => {
                      const subChartHeight = subChartHeightPreset === 'compact' ? 'h-[85px]' : subChartHeightPreset === 'balanced' ? 'h-[125px]' : 'h-[185px]';
                      return (
                        <>
                          {/* 1. Volume Sub-Chart */}
                          {showVolume && (
                            <div className={`relative-chart-container relative ${subChartHeight} w-full border-t border-panel-border pt-2`}>
                              {crosshairEnabled && crosshairYPercent !== null && (
                                <div 
                                  className="absolute left-0 right-0 h-[1px] border-t border-dashed border-indigo-500/60 pointer-events-none z-30"
                                  style={{ top: `${crosshairYPercent}%` }}
                                />
                              )}
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-[10px] text-panel-subtext font-semibold tracking-wider font-mono uppercase block">
                                  Volume Bar Chart
                                </span>
                                <span className="text-[10px] font-mono text-indigo-400 font-bold">
                                  Vol: {slicedChartPoints[slicedChartPoints.length - 1]?.volume?.toLocaleString() || 'N/A'}
                                </span>
                              </div>
                              <ResponsiveContainer width="100%" height="100%">
                                <ComposedChart 
                                  data={slicedChartPoints} 
                                  margin={{ top: 5, right: 10, left: 10, bottom: 0 }}
                                  onMouseMove={handleChartMouseMove}
                                  onMouseLeave={handleChartMouseLeave}
                                >
                                  <CartesianGrid strokeDasharray="3 3" stroke="var(--grid-line)" />
                                  <XAxis dataKey="time" hide />
                                  <YAxis stroke="var(--panel-subtext)" fontSize={9} domain={[0, 'auto']} orientation={priceScaleAxis} tickFormatter={(v) => v >= 1000000 ? `${(v/1000000).toFixed(1)}M` : v >= 1000 ? `${(v/1000).toFixed(1)}K` : v} />
                                  <Tooltip contentStyle={{ backgroundColor: 'var(--panel-bg)', borderColor: 'var(--panel-border)', borderRadius: '8px', fontSize: '11px', color: 'var(--canvas-text)' }} />
                                  {crosshairEnabled && crosshairLabel && (
                                    <ReferenceLine x={crosshairLabel} stroke="rgba(129, 140, 248, 0.65)" strokeWidth={1} strokeDasharray="3 3" />
                                  )}
                                  <Bar dataKey="volume" fill="#818cf8" opacity={0.4}>
                                    {slicedChartPoints.map((entry, index) => {
                                      const isUp = entry.close >= entry.open;
                                      return <Cell key={`vol-cell-${index}`} fill={isUp ? '#10b981' : '#f43f5e'} opacity={0.6} />;
                                    })}
                                  </Bar>
                                </ComposedChart>
                              </ResponsiveContainer>
                            </div>
                          )}

                          {/* 2. RSI Oscillator Sub-Chart */}
                          {showRSI && (
                            <div className={`relative-chart-container relative ${subChartHeight} w-full border-t border-panel-border pt-2`}>
                              {crosshairEnabled && crosshairYPercent !== null && (
                                <div 
                                  className="absolute left-0 right-0 h-[1px] border-t border-dashed border-indigo-500/60 pointer-events-none z-30"
                                  style={{ top: `${crosshairYPercent}%` }}
                                />
                              )}
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-[10px] text-panel-subtext font-semibold tracking-wider font-mono uppercase block">
                                  Relative Strength Index (14)
                                </span>
                                <span className="text-[10px] font-mono text-purple-400 font-bold">
                                  RSI: {slicedChartPoints[slicedChartPoints.length - 1]?.indicators?.rsi?.toFixed(2) || 'N/A'}
                                </span>
                              </div>
                              <ResponsiveContainer width="100%" height="100%">
                                <ComposedChart 
                                  data={slicedChartPoints} 
                                  margin={{ top: 5, right: 10, left: 10, bottom: 0 }}
                                  onMouseMove={handleChartMouseMove}
                                  onMouseLeave={handleChartMouseLeave}
                                >
                                  <CartesianGrid strokeDasharray="3 3" stroke="var(--grid-line)" />
                                  <XAxis dataKey="time" hide />
                                  <YAxis stroke="var(--panel-subtext)" fontSize={9} domain={[0, 100]} ticks={[30, 70]} orientation={priceScaleAxis} />
                                  <Tooltip contentStyle={{ backgroundColor: 'var(--panel-bg)', borderColor: 'var(--panel-border)', borderRadius: '8px', fontSize: '11px', color: 'var(--canvas-text)' }} />
                                  {crosshairEnabled && crosshairLabel && (
                                    <ReferenceLine x={crosshairLabel} stroke="rgba(129, 140, 248, 0.65)" strokeWidth={1} strokeDasharray="3 3" />
                                  )}
                                  
                                  <ReferenceLine y={strategy.parameters.rsiOverbought} stroke="#ef4444" strokeDasharray="3 3" opacity={0.5} label={{ value: '70', fill: '#ef4444', fontSize: 8, position: 'right' }} />
                                  <ReferenceLine y={strategy.parameters.rsiOversold} stroke="#10b981" strokeDasharray="3 3" opacity={0.5} label={{ value: '30', fill: '#10b981', fontSize: 8, position: 'right' }} />
                                  
                                  <Line type="monotone" dataKey="indicators.rsi" stroke="#a78bfa" strokeWidth={1.5} dot={false} name="RSI" />
                                </ComposedChart>
                              </ResponsiveContainer>
                            </div>
                          )}

                          {/* 3. MACD Oscillator Sub-Chart */}
                          {showMACD && (
                            <div className={`relative-chart-container relative ${subChartHeight} w-full border-t border-panel-border pt-2`}>
                              {crosshairEnabled && crosshairYPercent !== null && (
                                <div 
                                  className="absolute left-0 right-0 h-[1px] border-t border-dashed border-indigo-500/60 pointer-events-none z-30"
                                  style={{ top: `${crosshairYPercent}%` }}
                                />
                              )}
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-[10px] text-panel-subtext font-semibold tracking-wider font-mono uppercase block">
                                  MACD (12, 26, 9)
                                </span>
                                <div className="flex items-center gap-1.5 text-[9px] font-mono">
                                  <span className="text-emerald-400 font-bold">Line: {slicedChartPoints[slicedChartPoints.length - 1]?.indicators?.macd?.macdLine?.toFixed(2) || '0.00'}</span>
                                  <span className="text-amber-400 font-bold">Signal: {slicedChartPoints[slicedChartPoints.length - 1]?.indicators?.macd?.signalLine?.toFixed(2) || '0.00'}</span>
                                </div>
                              </div>
                              <ResponsiveContainer width="100%" height="100%">
                                <ComposedChart 
                                  data={slicedChartPoints} 
                                  margin={{ top: 5, right: 10, left: 10, bottom: 0 }}
                                  onMouseMove={handleChartMouseMove}
                                  onMouseLeave={handleChartMouseLeave}
                                >
                                  <CartesianGrid strokeDasharray="3 3" stroke="var(--grid-line)" />
                                  <XAxis dataKey="time" hide />
                                  <YAxis stroke="var(--panel-subtext)" fontSize={9} domain={['auto', 'auto']} orientation={priceScaleAxis} />
                                  <Tooltip contentStyle={{ backgroundColor: 'var(--panel-bg)', borderColor: 'var(--panel-border)', borderRadius: '8px', fontSize: '11px', color: 'var(--canvas-text)' }} />
                                  {crosshairEnabled && crosshairLabel && (
                                    <ReferenceLine x={crosshairLabel} stroke="rgba(129, 140, 248, 0.65)" strokeWidth={1} strokeDasharray="3 3" />
                                  )}
                                  
                                  <Bar dataKey="indicators.macd.histogram" name="Histogram">
                                    {slicedChartPoints.map((entry, index) => {
                                      const val = entry.indicators?.macd?.histogram || 0;
                                      return <Cell key={`macd-hist-${index}`} fill={val >= 0 ? '#10b981' : '#f43f5e'} opacity={0.6} />;
                                    })}
                                  </Bar>
                                  <Line type="monotone" dataKey="indicators.macd.macdLine" stroke="#10b981" strokeWidth={1.5} dot={false} name="MACD Line" />
                                  <Line type="monotone" dataKey="indicators.macd.signalLine" stroke="#f59e0b" strokeWidth={1.2} dot={false} name="Signal Line" />
                                </ComposedChart>
                              </ResponsiveContainer>
                            </div>
                          )}

                          {/* 4. Stochastic Oscillator Sub-Chart */}
                          {showStochastic && (
                            <div className={`relative-chart-container relative ${subChartHeight} w-full border-t border-panel-border pt-2`}>
                              {crosshairEnabled && crosshairYPercent !== null && (
                                <div 
                                  className="absolute left-0 right-0 h-[1px] border-t border-dashed border-indigo-500/60 pointer-events-none z-30"
                                  style={{ top: `${crosshairYPercent}%` }}
                                />
                              )}
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-[10px] text-panel-subtext font-semibold tracking-wider font-mono uppercase block">
                                  Stochastic Oscillator (14, 3)
                                </span>
                                <div className="flex items-center gap-1.5 text-[9px] font-mono">
                                  <span className="text-amber-400 font-bold">%K: {slicedChartPoints[slicedChartPoints.length - 1]?.indicators?.stochastic?.k?.toFixed(2) || 'N/A'}</span>
                                  <span className="text-sky-400 font-bold">%D: {slicedChartPoints[slicedChartPoints.length - 1]?.indicators?.stochastic?.d?.toFixed(2) || 'N/A'}</span>
                                </div>
                              </div>
                              <ResponsiveContainer width="100%" height="100%">
                                <ComposedChart 
                                  data={slicedChartPoints} 
                                  margin={{ top: 5, right: 10, left: 10, bottom: 0 }}
                                  onMouseMove={handleChartMouseMove}
                                  onMouseLeave={handleChartMouseLeave}
                                >
                                  <CartesianGrid strokeDasharray="3 3" stroke="var(--grid-line)" />
                                  <XAxis dataKey="time" hide />
                                  <YAxis stroke="var(--panel-subtext)" fontSize={9} domain={[0, 100]} ticks={[20, 80]} orientation={priceScaleAxis} />
                                  <Tooltip contentStyle={{ backgroundColor: 'var(--panel-bg)', borderColor: 'var(--panel-border)', borderRadius: '8px', fontSize: '11px', color: 'var(--canvas-text)' }} />
                                  {crosshairEnabled && crosshairLabel && (
                                    <ReferenceLine x={crosshairLabel} stroke="rgba(129, 140, 248, 0.65)" strokeWidth={1} strokeDasharray="3 3" />
                                  )}
                                  
                                  <ReferenceLine y={80} stroke="#f43f5e" strokeDasharray="3 3" opacity={0.4} label={{ value: '80', fill: '#f43f5e', fontSize: 8, position: 'right' }} />
                                  <ReferenceLine y={20} stroke="#10b981" strokeDasharray="3 3" opacity={0.4} label={{ value: '20', fill: '#10b981', fontSize: 8, position: 'right' }} />
                                  
                                  <Line type="monotone" dataKey="indicators.stochastic.k" stroke="#f59e0b" strokeWidth={1.5} dot={false} name="%K" />
                                  <Line type="monotone" dataKey="indicators.stochastic.d" stroke="#38bdf8" strokeWidth={1.2} dot={false} name="%D" />
                                </ComposedChart>
                              </ResponsiveContainer>
                            </div>
                          )}

                          {/* 5. ATR Volatility Sub-Chart */}
                          {showATR && (
                            <div className={`relative-chart-container relative ${subChartHeight} w-full border-t border-panel-border pt-2`}>
                              {crosshairEnabled && crosshairYPercent !== null && (
                                <div 
                                  className="absolute left-0 right-0 h-[1px] border-t border-dashed border-indigo-500/60 pointer-events-none z-30"
                                  style={{ top: `${crosshairYPercent}%` }}
                                />
                              )}
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-[10px] text-panel-subtext font-semibold tracking-wider font-mono uppercase block">
                                  Average True Range (14) - Volatility Index
                                </span>
                                <span className="text-[10px] font-mono text-rose-400 font-bold">
                                  ATR: {slicedChartPoints[slicedChartPoints.length - 1]?.indicators?.atr?.toFixed(4) || 'N/A'}
                                </span>
                              </div>
                              <ResponsiveContainer width="100%" height="100%">
                                <ComposedChart 
                                  data={slicedChartPoints} 
                                  margin={{ top: 5, right: 10, left: 10, bottom: 0 }}
                                  onMouseMove={handleChartMouseMove}
                                  onMouseLeave={handleChartMouseLeave}
                                >
                                  <CartesianGrid strokeDasharray="3 3" stroke="var(--grid-line)" />
                                  <XAxis dataKey="time" hide />
                                  <YAxis stroke="var(--panel-subtext)" fontSize={9} domain={['auto', 'auto']} orientation={priceScaleAxis} />
                                  <Tooltip contentStyle={{ backgroundColor: 'var(--panel-bg)', borderColor: 'var(--panel-border)', borderRadius: '8px', fontSize: '11px', color: 'var(--canvas-text)' }} />
                                  {crosshairEnabled && crosshairLabel && (
                                    <ReferenceLine x={crosshairLabel} stroke="rgba(129, 140, 248, 0.65)" strokeWidth={1} strokeDasharray="3 3" />
                                  )}
                                  
                                  <Area type="monotone" dataKey="indicators.atr" stroke="#f43f5e" strokeWidth={1.5} fill="#f43f5e" fillOpacity={0.06} dot={false} name="ATR" />
                                </ComposedChart>
                              </ResponsiveContainer>
                            </div>
                          )}
                        </>
                      );
                    })()}
                    {/* Stacked Modular Oscillator Panels */}
                    <StackedOscillators
                      candles={slicedChartPoints}
                      crosshair={{ enabled: crosshairEnabled, label: crosshairLabel, yPercent: crosshairYPercent }}
                      onMouseMove={handleChartMouseMove}
                      onMouseLeave={handleChartMouseLeave}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
          )}

          {/* ========================================== */}
          {/* 2.1 4-WAY MULTI-CHART MATRIX SECTION       */}
          {/* ========================================== */}
          {(activeSidebarTab === 'matrix-section' || workspaceLayout === 'multi') && (
            <div id="matrix-section" className="w-full space-y-5">
              <MultiChartMatrix
                matrixTickers={multiChartTickers}
                marketData={marketData}
                onSelectTicker={(t) => {
                  setSelectedTicker(t);
                  setWorkspaceLayout('single');
                  setActiveSidebarTab('cockpit-section');
                }}
                onSetMatrixTicker={(idx, t) => {
                  setMultiChartTickers((prev) => {
                    const next = [...prev];
                    next[idx] = t;
                    return next;
                  });
                }}
                chartMode={chartType}
                availableTickers={Object.keys(TICKER_INFO)}
                tickerNames={POPULAR_NAMES}
              />
            </div>
          )}

          {/* ========================================== */}
          {/* 2.2 AUTOMATED EXECUTION & RISK BLOTTER    */}
          {/* ========================================== */}
          {activeSidebarTab === 'execution-blotter-section' && (
            <div id="execution-blotter-section" className="w-full">
              <ExecutionBlotter
                portfolio={portfolio}
                positions={positions}
                orders={orders}
                agentLogs={agentLogs}
                automatedTickers={automatedTickers}
                onToggleAutomatedTicker={(ticker) => {
                  setAutomatedTickers((prev) => ({
                    ...prev,
                    [ticker]: !prev[ticker],
                  }));
                }}
                onExecuteManualOrder={(ticker, side, qty) => {
                  const currentPrice = marketData[ticker]?.[marketData[ticker].length - 1]?.close || 100;
                  const newOrder: Order = {
                    id: `ord-${Date.now()}`,
                    ticker,
                    side,
                    type: 'MARKET',
                    price: currentPrice,
                    quantity: qty,
                    amount: currentPrice * qty,
                    status: 'FILLED',
                    timestamp: new Date().toISOString(),
                    is_live: false,
                    execution_latency_ms: Math.floor(Math.random() * 15) + 5,
                  };
                  setOrders((prev) => [newOrder, ...prev]);

                  // Update position
                  setPositions((prev) => {
                    const existing = prev.find((p) => p.ticker === ticker);
                    if (side === 'BUY') {
                      if (existing) {
                        const newQty = existing.quantity + qty;
                        const newAvg = (existing.averagePrice * existing.quantity + currentPrice * qty) / newQty;
                        return prev.map((p) => (p.ticker === ticker ? { ...p, quantity: newQty, averagePrice: newAvg } : p));
                      }
                      return [...prev, { ticker, quantity: qty, averagePrice: currentPrice, currentPrice, unrealizedPnL: 0, trailingStopPrice: null, is_live: false }];
                    } else {
                      if (!existing) return prev;
                      const newQty = existing.quantity - qty;
                      if (newQty <= 0) return prev.filter((p) => p.ticker !== ticker);
                      return prev.map((p) => (p.ticker === ticker ? { ...p, quantity: newQty } : p));
                    }
                  });
                }}
                onLiquidatePosition={(ticker) => {
                  setPositions((prev) => prev.filter((p) => p.ticker !== ticker));
                }}
                availableTickers={Object.keys(TICKER_INFO)}
                currentPrices={Object.fromEntries(
                  Object.keys(marketData).map((k) => [k, marketData[k]?.[marketData[k].length - 1]?.close || 100])
                )}
              />
            </div>
          )}

          {/* ========================================== */}
          {/* 3. STRATEGY & BACKTEST LAB                 */}
          {/* ========================================== */}
          {(activeSidebarTab === 'strategy-lab-section' || activeSidebarTab === 'strategy-builder-panel' || activeSidebarTab === 'strategy-backtester-container') && (
            <div id="strategy-lab-section" className="w-full space-y-5 bg-panel-bg border border-panel-border rounded-xl p-5 shadow-sm transition-colors duration-200">
              <div className="flex items-center justify-between border-b border-panel-border pb-3">
                <div className="flex items-center gap-2">
                  <Sliders className="text-indigo-500 animate-pulse" size={18} />
                  <div>
                    <h3 className="text-xs font-bold text-panel-heading tracking-tight flex items-center gap-1.5 uppercase font-mono">
                      🔬 Quantitative Strategy & Simulation Lab
                    </h3>
                    <p className="text-[10px] text-panel-subtext mt-0.5">
                      Configure mathematical entry/exit triggers, Infinitron pivot breakouts, and backtest historical performance metrics.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveSidebarTab('cockpit-section')}
                  className="p-1 rounded-lg hover:bg-panel-border text-panel-subtext hover:text-panel-heading transition cursor-pointer"
                  title="Return to Cockpit"
                >
                  <X size={15} />
                </button>
              </div>

              {/* Sub tabs: Builder vs. Backtester */}
              <div className="flex bg-panel-inner-bg p-1 rounded-lg border border-panel-border grid grid-cols-2 select-none">
                <button
                  type="button"
                  onClick={() => setActiveBottomTab('builder')}
                  className={`py-1.5 rounded-md text-[10px] font-bold font-mono uppercase transition flex items-center justify-center gap-1.5 cursor-pointer ${
                    activeBottomTab === 'builder'
                      ? 'bg-indigo-650 text-white shadow-sm'
                      : 'text-panel-subtext hover:text-panel-heading hover:bg-panel-bg'
                  }`}
                >
                  🛠️ Visual Strategy Builder
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveBottomTab('backtester');
                    addLog('DATA_INDICATOR', 'INFO', 'Opened Quantitative Historical Strategy Backtester.');
                  }}
                  className={`py-1.5 rounded-md text-[10px] font-bold font-mono uppercase transition flex items-center justify-center gap-1.5 cursor-pointer ${
                    activeBottomTab === 'backtester'
                      ? 'bg-indigo-650 text-white shadow-sm'
                      : 'text-panel-subtext hover:text-panel-heading hover:bg-panel-bg'
                  }`}
                >
                  📈 Quantitative Backtester
                </button>
              </div>

              {activeBottomTab === 'builder' ? (
                <div className="space-y-4">
                  <StrategyBuilder 
                    strategy={strategy} 
                    onChangeStrategy={(updated) => setStrategy(updated)} 
                  />
                </div>
              ) : (
                <div className="space-y-4">
                  <StrategyBacktester
                    candles={marketData[selectedTicker] || []}
                    selectedTicker={selectedTicker}
                    tickers={Object.keys(marketData)}
                    onChangeTicker={(t) => setSelectedTicker(t)}
                    defaultRsiOverbought={strategy.parameters.rsiOverbought}
                    defaultRsiOversold={strategy.parameters.rsiOversold}
                    defaultTrailingStop={strategy.parameters.trailingStopPercent}
                  />
                </div>
              )}
            </div>
          )}

          {/* Business First Enterprise Footer */}
          <footer className="mt-12 pt-6 pb-12 border-t border-panel-border flex flex-col md:flex-row items-center justify-between text-xs text-panel-subtext font-mono gap-4">
            <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-4 text-center sm:text-left">
              <p className="font-semibold text-panel-heading">
                &copy; 2026 AlgoTrade Matrix&trade; &bull; Institutional Quantitative Strategy Engine
              </p>
              <span className="hidden sm:inline opacity-40">&bull;</span>
              <span className="text-[11px] text-emerald-500 font-medium flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                Real-Time Feeds Active
              </span>
            </div>
            <div className="flex items-center gap-4 text-[11px]">
              <span>Developed by <strong className="text-panel-heading">Bonga Manzini</strong></span>
              <span className="opacity-40">&bull;</span>
              <a 
                href="https://github.com/BongaManzini/automated-multi-stock-algo-trading-platform" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="text-indigo-400 hover:text-indigo-300 font-bold flex items-center gap-1 transition-colors"
              >
                GitHub Repository
              </a>
            </div>
          </footer>

        </div>

      </div>

      {/* ⚡ Real-Time Temporary 'Flash' Notification Banners */}
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 w-full max-w-md px-4 pointer-events-none">
        <AnimatePresence>
          {activeFlashAlerts.filter((alt, idx, self) => self.findIndex(a => a.id === alt.id) === idx).map((alt) => {
            const isGrowth = alt.direction === 'GROWTH';
            return (
              <motion.div
                key={alt.id}
                initial={{ opacity: 0, y: -20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.95 }}
                transition={{ type: 'spring', stiffness: 350, damping: 25 }}
                className={`pointer-events-auto w-full p-3.5 rounded-xl border shadow-xl flex items-center justify-between gap-3 transition-all backdrop-blur-md ${
                  isGrowth
                    ? 'bg-emerald-500/95 dark:bg-emerald-950/95 border-emerald-400 dark:border-emerald-800 text-white dark:text-emerald-100'
                    : 'bg-rose-500/95 dark:bg-rose-950/95 border-rose-400 dark:border-rose-800 text-white dark:text-rose-100'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div className={`p-1.5 rounded-lg text-xs font-black ${
                    isGrowth ? 'bg-emerald-600/30 dark:bg-emerald-900/60' : 'bg-rose-600/30 dark:bg-rose-900/60'
                  }`}>
                    {isGrowth ? '📈' : '📉'}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-extrabold text-[13px] tracking-wide uppercase font-mono">{alt.ticker}</span>
                      <span className="text-[10px] opacity-75 font-mono">{alt.timestamp}</span>
                    </div>
                    <p className="text-[11px] leading-snug mt-0.5 font-medium">
                      Volatility Spike: <span className="font-bold">{isGrowth ? '+' : ''}{alt.changePercent.toFixed(2)}%</span> at ${alt.price.toFixed(2)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedTicker(alt.ticker);
                      setQuickTradeTicker(alt.ticker);
                      // Remove this flash notification
                      setActiveFlashAlerts(current => current.filter(item => item.id !== alt.id));
                    }}
                    className="px-2.5 py-1 rounded bg-white text-gray-950 text-[10.5px] font-extrabold hover:bg-opacity-90 active:scale-95 transition shadow cursor-pointer whitespace-nowrap"
                  >
                    ⚡ Trade
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveFlashAlerts(current => current.filter(item => item.id !== alt.id))}
                    className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/15 text-white/80 hover:text-white cursor-pointer"
                  >
                    <X size={14} />
                  </button>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* 📊 Visual Volatility Alert Analytics Summary Modal */}
      <AnimatePresence>
        {isSummaryModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSummaryModalOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />

            {/* Content Window */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ type: 'spring', duration: 0.35 }}
              className="relative w-full max-w-3xl bg-panel-bg border border-panel-border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] z-10 transition-colors"
            >
              {/* Header */}
              <div className="p-5 border-b border-panel-border flex items-center justify-between bg-panel-inner-bg">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-indigo-600/10 rounded-lg text-indigo-600 dark:text-indigo-400">
                    <BellRing size={18} className="animate-pulse" />
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold text-panel-heading uppercase tracking-wider font-mono">
                      Volatility Alert Analytics
                    </h3>
                    <p className="text-[11px] text-panel-subtext mt-0.5">
                      Aggregated feed intelligence of real-time market anomalies
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsSummaryModalOpen(false)}
                  className="p-1.5 rounded-lg border border-panel-border text-panel-subtext hover:text-panel-heading hover:bg-panel-inner-bg transition cursor-pointer"
                >
                  <X size={15} />
                </button>
              </div>

              {/* Body */}
              <div className="p-6 overflow-y-auto space-y-6 scrollbar-thin flex-1">
                
                {/* 1. Bento Statistics Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {/* Metric: Total Triggered */}
                  <div className="p-4 bg-panel-inner-bg border border-panel-border rounded-xl flex flex-col justify-between">
                    <span className="text-[9px] text-panel-subtext font-mono uppercase tracking-widest block">Total Triggers</span>
                    <span className="text-xl font-black font-mono mt-1 text-panel-heading">{alerts.length}</span>
                    <span className="text-[9px] text-panel-subtext/80 mt-0.5">All monitored tickers</span>
                  </div>

                  {/* Metric: Growth vs Drop */}
                  <div className="p-4 bg-panel-inner-bg border border-panel-border rounded-xl flex flex-col justify-between">
                    <span className="text-[9px] text-panel-subtext font-mono uppercase tracking-widest block">Growth vs Drop</span>
                    <div className="flex items-baseline gap-1 mt-1 font-mono text-panel-heading">
                      <span className="text-base font-bold text-emerald-500">
                        {alerts.filter(a => a.direction === 'GROWTH').length}▲
                      </span>
                      <span className="text-xs text-panel-subtext">/</span>
                      <span className="text-base font-bold text-rose-500">
                        {alerts.filter(a => a.direction === 'LOSS').length}▼
                      </span>
                    </div>
                    <span className="text-[9px] text-panel-subtext/80 mt-0.5">Direction ratio</span>
                  </div>

                  {/* Metric: Most Volatile */}
                  <div className="p-4 bg-panel-inner-bg border border-panel-border rounded-xl flex flex-col justify-between">
                    <span className="text-[9px] text-panel-subtext font-mono uppercase tracking-widest block">Most Active</span>
                    {(() => {
                      const tickerCounts: Record<string, number> = {};
                      alerts.forEach(a => {
                        tickerCounts[a.ticker] = (tickerCounts[a.ticker] || 0) + 1;
                      });
                      let mostActive = 'N/A';
                      let count = 0;
                      Object.keys(tickerCounts).forEach((tick) => {
                        const cnt = tickerCounts[tick];
                        if (cnt > count) {
                          count = cnt;
                          mostActive = tick;
                        }
                      });
                      return (
                        <>
                          <span className="text-base font-bold font-mono mt-1 text-panel-heading uppercase flex items-center gap-1.5">
                            {mostActive}
                            {count > 0 && (
                              <span className="text-[10px] text-panel-subtext font-normal font-sans">({count}x)</span>
                            )}
                          </span>
                          <span className="text-[9px] text-panel-subtext/80 mt-0.5">Most spike events</span>
                        </>
                      );
                    })()}
                  </div>

                  {/* Metric: Max Spike */}
                  <div className="p-4 bg-panel-inner-bg border border-panel-border rounded-xl flex flex-col justify-between">
                    <span className="text-[9px] text-panel-subtext font-mono uppercase tracking-widest block">Peak Movement</span>
                    {(() => {
                      const peakAlert = alerts.reduce((max, a) => {
                        if (!max || Math.abs(a.changePercent) > Math.abs(max.changePercent)) return a;
                        return max;
                      }, null as PriceAlert | null);
                      return (
                        <>
                          <span className={`text-base font-bold font-mono mt-1 flex items-center gap-0.5 ${
                            peakAlert ? (peakAlert.direction === 'GROWTH' ? 'text-emerald-500' : 'text-rose-500') : 'text-panel-heading'
                          }`}>
                            {peakAlert ? `${peakAlert.direction === 'GROWTH' ? '+' : ''}${peakAlert.changePercent.toFixed(2)}%` : '0.00%'}
                          </span>
                          <span className="text-[9px] text-panel-subtext/80 mt-0.5 uppercase font-mono text-panel-heading">
                            {peakAlert ? peakAlert.ticker : 'N/A'}
                          </span>
                        </>
                      );
                    })()}
                  </div>
                </div>

                {/* 2. Alerts Distribution Visual Chart */}
                <div className="p-4 bg-panel-inner-bg border border-panel-border rounded-xl space-y-3">
                  <h4 className="text-[10px] text-panel-subtext font-mono uppercase tracking-wider font-bold">
                    Volatility Distribution across Assets
                  </h4>
                  {alerts.length === 0 ? (
                    <div className="py-8 text-center text-panel-subtext font-mono text-[10px]">
                      No alert data available to display distribution chart.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {(() => {
                        const distCounts: Record<string, number> = {};
                        alerts.forEach(a => {
                          distCounts[a.ticker] = (distCounts[a.ticker] || 0) + 1;
                        });
                        const allCounts = Object.keys(distCounts).map(k => distCounts[k]);
                        const maxCount = Math.max(...allCounts, 1);

                        return Object.keys(distCounts).map((ticker) => {
                          const count = distCounts[ticker];
                          const percent = (count / maxCount) * 100;
                          return (
                            <div key={ticker} className="flex items-center gap-3 text-xs">
                              <span className="font-mono font-bold w-12 text-panel-heading">{ticker}</span>
                              <div className="flex-1 bg-panel-border h-2 rounded-full overflow-hidden">
                                <div
                                  className="bg-indigo-500 h-full rounded-full transition-all duration-500"
                                  style={{ width: `${percent}%` }}
                                />
                              </div>
                              <span className="font-mono text-[10px] text-panel-subtext w-12 text-right">
                                {count} trigger{count > 1 ? 's' : ''}
                              </span>
                            </div>
                          );
                        });
                      })()}
                    </div>
                  )}
                </div>

                {/* 3. Interactive Alerts Ledger / Table */}
                <div className="space-y-2.5">
                  <h4 className="text-[10px] text-panel-subtext font-mono uppercase tracking-wider font-bold">
                    Historical Volatility Logs ({alerts.length} Records)
                  </h4>
                  <div className="border border-panel-border rounded-xl overflow-hidden bg-panel-inner-bg">
                    <div className="max-h-[220px] overflow-y-auto scrollbar-thin">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-panel-border/30 border-b border-panel-border text-panel-subtext font-mono text-[9px] uppercase tracking-wider">
                            <th className="p-3">Asset</th>
                            <th className="p-3">Shift (Move %)</th>
                            <th className="p-3">Trigger Price</th>
                            <th className="p-3">Timestamp</th>
                            <th className="p-3 text-right">Action Interface</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-panel-border/40 font-mono text-[11px]">
                          {alerts.length === 0 ? (
                            <tr>
                              <td colSpan={5} className="p-8 text-center text-panel-subtext font-mono text-[10px]">
                                The alert log is empty. Set your Spike Sensitivity lower to capture minor price changes.
                              </td>
                            </tr>
                          ) : (
                            alerts.filter((alt, idx, self) => self.findIndex(a => a.id === alt.id) === idx).map((alt) => {
                              const isGrowth = alt.direction === 'GROWTH';
                              return (
                                <tr key={alt.id} className="hover:bg-panel-border/25 transition">
                                  <td className="p-3 font-bold text-panel-heading uppercase">{alt.ticker}</td>
                                  <td className="p-3">
                                    <span className={`font-bold px-1.5 py-0.5 rounded ${
                                      isGrowth
                                        ? 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400'
                                        : 'bg-rose-100 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400'
                                    }`}>
                                      {isGrowth ? '▲ +' : '▼ '}{alt.changePercent.toFixed(2)}%
                                    </span>
                                  </td>
                                  <td className="p-3 text-panel-heading">${alt.price.toFixed(2)}</td>
                                  <td className="p-3 text-panel-subtext">{alt.timestamp}</td>
                                  <td className="p-3 text-right">
                                    <div className="inline-flex items-center gap-1.5">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setSelectedTicker(alt.ticker);
                                          setQuickTradeTicker(alt.ticker);
                                        }}
                                        className="px-2.5 py-0.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[9.5px] uppercase rounded tracking-wider cursor-pointer transition shadow-sm"
                                      >
                                        ⚡ Trade
                                      </button>
                                      {!alt.acknowledged ? (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setAlerts(prev => prev.map(a => a.id === alt.id ? { ...a, acknowledged: true } : a));
                                          }}
                                          className="text-panel-subtext hover:text-panel-heading text-[10px] px-1 hover:underline cursor-pointer"
                                        >
                                          Mark Read
                                        </button>
                                      ) : (
                                        <span className="text-[8px] text-panel-subtext/60">Read</span>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="p-4 border-t border-panel-border bg-panel-inner-bg flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => {
                    if (confirm('Are you sure you want to clear all volatility alerts history?')) {
                      setAlerts([]);
                    }
                  }}
                  disabled={alerts.length === 0}
                  className="px-3 py-1.5 rounded-lg border border-red-200 dark:border-red-950 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 text-[11px] font-bold transition disabled:opacity-40 cursor-pointer"
                >
                  Clear All Alerts
                </button>
                <button
                  type="button"
                  onClick={() => setIsSummaryModalOpen(false)}
                  className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition cursor-pointer shadow-md shadow-indigo-950/20"
                >
                  Close Analysis
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ⚡ Quick Trade Execution Dialog */}
      <AnimatePresence>
        {quickTradeTicker && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setQuickTradeTicker(null)}
              className="absolute inset-0 bg-black/70 backdrop-blur-md"
            />

            {/* Dialog Content */}
            {(() => {
              const ticker = quickTradeTicker;
              const price = currentPrices[ticker] || 0;
              const cash = portfolio.cash;
              const pos = positions.find(p => p.ticker === ticker);
              
              return (
                <QuickTradeModal
                  ticker={ticker}
                  price={price}
                  cash={cash}
                  position={pos}
                  onClose={() => setQuickTradeTicker(null)}
                  executeOrder={executeOrder}
                />
              );
            })()}
          </div>
        )}
      </AnimatePresence>

      {/* 🔔 FLOATING ALERT CENTER WIDGET */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-3 pointer-events-none">
        <AnimatePresence>
          {isAlertBoxOpen && (
            <motion.div
              initial={{ opacity: 0, y: 30, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              className="pointer-events-auto w-[360px] h-[480px] bg-panel-bg border border-panel-border rounded-2xl shadow-2xl overflow-hidden flex flex-col transition-colors duration-200"
            >
              {/* Header */}
              <div className="p-3.5 border-b border-panel-border bg-panel-inner-bg flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-indigo-600/10 rounded-lg text-indigo-600 dark:text-indigo-400 shrink-0">
                    <BellRing size={16} className="animate-pulse" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-panel-heading uppercase tracking-wider font-mono">
                      Alert Feed Center
                    </h4>
                    <p className="text-[9px] text-panel-subtext">Real-time market anomalies</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {/* Toggle popups switch */}
                  <label className="flex items-center gap-1.5 cursor-pointer bg-panel-bg px-2 py-1 rounded border border-panel-border text-[9.5px] font-mono text-panel-subtext select-none">
                    <span>Popups</span>
                    <input 
                      type="checkbox" 
                      checked={enableAlertPopups} 
                      onChange={(e) => {
                        setEnableAlertPopups(e.target.checked);
                        addLog('DATA_INDICATOR', 'INFO', `Market alert flash popups ${e.target.checked ? 'ENABLED' : 'MUTED'}.`);
                      }}
                      className="rounded accent-indigo-600 bg-panel-inner-bg border-panel-border cursor-pointer h-3 w-3"
                    />
                    <span className={enableAlertPopups ? 'text-indigo-500 font-bold' : 'text-panel-subtext font-bold'}>
                      {enableAlertPopups ? 'ON' : 'OFF'}
                    </span>
                  </label>
                  
                  <button
                    type="button"
                    onClick={() => setIsAlertBoxOpen(false)}
                    className="p-1 rounded hover:bg-panel-border text-panel-subtext hover:text-panel-heading transition cursor-pointer"
                  >
                    <X size={15} />
                  </button>
                </div>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto p-3.5 space-y-2 scrollbar-thin">
                {alerts.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-2">
                    <span className="text-2xl opacity-75">🔔</span>
                    <p className="text-[11px] text-panel-subtext font-mono font-medium">No alerts triggered yet.</p>
                    <p className="text-[9px] text-panel-subtext/70 leading-snug">
                      Set your Volatility Threshold lower in the sidebar to capture minor price shifts.
                    </p>
                  </div>
                ) : (
                  alerts.filter((alt, idx, self) => self.findIndex(a => a.id === alt.id) === idx).map((alt) => {
                    const isGrowth = alt.direction === 'GROWTH';
                    return (
                      <div 
                        key={alt.id} 
                        className={`p-2.5 rounded-xl border flex flex-col gap-1.5 transition-all text-xs ${
                          alt.acknowledged 
                            ? 'bg-panel-inner-bg/40 border-panel-border/50 opacity-70' 
                            : isGrowth 
                            ? 'bg-emerald-500/5 dark:bg-emerald-950/20 border-emerald-500/20 dark:border-emerald-950 text-panel-heading'
                            : 'bg-rose-500/5 dark:bg-rose-950/20 border-rose-500/20 dark:border-rose-950 text-panel-heading'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <span className="font-black text-xs font-mono uppercase tracking-wide">{alt.ticker}</span>
                            <span className={`text-[9px] font-bold font-mono px-1 rounded ${
                              isGrowth 
                                ? 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400' 
                                : 'bg-rose-100 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400'
                            }`}>
                              {isGrowth ? '▲ +' : '▼ '}{alt.changePercent.toFixed(2)}%
                            </span>
                          </div>
                          <span className="text-[9px] text-panel-subtext font-mono">{alt.timestamp}</span>
                        </div>
                        
                        <div className="flex items-center justify-between mt-1 text-[10px]">
                          <span className="text-panel-subtext font-mono">
                            Triggered at <strong className="text-panel-heading font-extrabold">${alt.price.toFixed(2)}</strong>
                          </span>
                          
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedTicker(alt.ticker);
                                setQuickTradeTicker(alt.ticker);
                              }}
                              className="px-2 py-0.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[9px] uppercase font-bold rounded tracking-wider transition cursor-pointer"
                            >
                              ⚡ Trade
                            </button>
                            {!alt.acknowledged && (
                              <button
                                type="button"
                                onClick={() => {
                                  setAlerts(prev => prev.map(a => a.id === alt.id ? { ...a, acknowledged: true } : a));
                                }}
                                className="px-2 py-0.5 bg-panel-border hover:bg-panel-border/80 text-panel-heading text-[9px] rounded font-medium transition cursor-pointer"
                              >
                                Read
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Footer */}
              <div className="p-3 border-t border-panel-border bg-panel-inner-bg flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => {
                    if (confirm('Clear all alerts?')) {
                      setAlerts([]);
                    }
                  }}
                  disabled={alerts.length === 0}
                  className="px-2.5 py-1 rounded-lg border border-red-200 dark:border-red-950 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 text-[10px] font-bold transition disabled:opacity-40 cursor-pointer"
                >
                  Clear Feed
                </button>
                <button
                  type="button"
                  onClick={() => {
                    // Mark all as read
                    setAlerts(prev => prev.map(a => ({ ...a, acknowledged: true })));
                  }}
                  disabled={alerts.filter(a => !a.acknowledged).length === 0}
                  className="px-2.5 py-1 rounded-lg border border-panel-border text-panel-subtext hover:text-panel-heading text-[10px] font-bold transition disabled:opacity-40 cursor-pointer"
                >
                  Mark All Read
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Floating Toggle Button */}
        <motion.button
          layout
          type="button"
          onClick={() => setIsAlertBoxOpen(!isAlertBoxOpen)}
          className="pointer-events-auto flex items-center gap-2 px-3.5 py-2.5 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white shadow-2xl transition hover:scale-105 active:scale-95 cursor-pointer border border-indigo-500/20"
        >
          {alerts.filter(a => !a.acknowledged).length > 0 ? (
            <div className="relative">
              <BellRing size={16} className="animate-bounce" />
              <span className="absolute -top-1.5 -right-1.5 h-3.5 min-w-[14px] bg-rose-500 border-2 border-indigo-600 rounded-full text-[8px] font-black font-mono flex items-center justify-center px-0.5 animate-pulse">
                {alerts.filter(a => !a.acknowledged).length}
              </span>
            </div>
          ) : (
            <Bell size={16} />
          )}
          <span className="text-xs font-bold font-mono uppercase tracking-wide">
            {isAlertBoxOpen ? 'Hide Alerts' : 'Market Alerts'}
          </span>
          <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full uppercase ${enableAlertPopups ? 'bg-emerald-500 text-white' : 'bg-indigo-900 text-indigo-200 border border-indigo-950'}`}>
            Popups: {enableAlertPopups ? 'ON' : 'OFF'}
          </span>
        </motion.button>

        {/* Terminal Feature Guide Modal */}
        <FeatureGuideModal
          isOpen={isGuideOpen}
          onClose={() => setIsGuideOpen(false)}
          viewDensity={viewDensity}
          setViewDensity={setViewDensity}
          eli5Mode={eli5Mode}
          setEli5Mode={setEli5Mode}
        />
      </div>
    </div>
    </div>
  );
}

// ----------------------------------------------------
// Sub-Component: Quick Trade Modal execution desk
// ----------------------------------------------------
interface QuickTradeModalProps {
  ticker: string;
  price: number;
  cash: number;
  position: Position | undefined;
  onClose: () => void;
  executeOrder: (ticker: string, side: 'BUY' | 'SELL', price: number, qty: number, comment: string) => void;
}

function QuickTradeModal({ ticker, price, cash, position, onClose, executeOrder }: QuickTradeModalProps) {
  const defaultAlloc = cash * 0.15; // 15% is standard risk agent ceiling
  const defaultQty = price > 0 ? Math.floor(defaultAlloc / price) || 1 : 1;
  const [qty, setQty] = useState<number>(defaultQty);

  const orderValue = Number((price * qty).toFixed(2));
  const canAfford = cash >= orderValue;

  const handleBuy = () => {
    if (qty <= 0) return;
    executeOrder(ticker, 'BUY', price, qty, `Quick manual placement from alert terminal.`);
    onClose();
  };

  const handleSellAll = () => {
    if (!position) return;
    executeOrder(ticker, 'SELL', price, position.quantity, `Quick manual position liquidation.`);
    onClose();
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 15 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: 15 }}
      transition={{ type: 'spring', duration: 0.3 }}
      className="relative w-full max-w-md bg-panel-bg border border-panel-border rounded-2xl shadow-2xl p-6 overflow-hidden z-10 transition-colors"
    >
      {/* Title */}
      <div className="flex items-center justify-between pb-4 border-b border-panel-border">
        <div>
          <h3 className="text-sm font-bold text-panel-heading uppercase tracking-wider font-mono flex items-center gap-1.5">
            <Cpu size={14} className="text-indigo-500 animate-pulse" />
            Quick Execution Desk
          </h3>
          <p className="text-[11px] text-panel-subtext mt-0.5">Asset: <span className="font-bold text-panel-heading">{ticker}</span> ({POPULAR_NAMES[ticker] || `${ticker} Stock`})</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded hover:bg-panel-border transition cursor-pointer text-panel-subtext hover:text-panel-heading"
        >
          <X size={16} />
        </button>
      </div>

      {/* Stats Block */}
      <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
        <div className="p-3 bg-panel-inner-bg border border-panel-border rounded-xl">
          <span className="text-[9px] text-panel-subtext uppercase font-mono block">Current price</span>
          <span className="text-base font-extrabold font-mono mt-1 text-panel-heading block">${price.toFixed(2)}</span>
        </div>
        <div className="p-3 bg-panel-inner-bg border border-panel-border rounded-xl">
          <span className="text-[9px] text-panel-subtext uppercase font-mono block">Available Cash</span>
          <span className="text-base font-extrabold font-mono mt-1 text-panel-heading block">${cash.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
        </div>
      </div>

      {/* Position Detail */}
      <div className="mt-4 p-3 bg-panel-inner-bg border border-panel-border rounded-xl text-xs">
        <span className="text-[9px] text-panel-subtext uppercase font-mono block">Your Holding</span>
        {position ? (
          <div className="flex items-center justify-between mt-1 font-mono">
            <div>
              <span className="font-extrabold text-panel-heading">{position.quantity} shares</span>
              <span className="text-[10px] text-panel-subtext block mt-0.5">Avg: ${position.averagePrice.toFixed(2)}</span>
            </div>
            <div className="text-right">
              <span className={`font-bold block ${position.unrealizedPnL >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                {position.unrealizedPnL >= 0 ? '+' : ''}${position.unrealizedPnL.toFixed(2)}
              </span>
              <span className="text-[9px] text-panel-subtext block">Unrealized P&L</span>
            </div>
          </div>
        ) : (
          <span className="text-panel-subtext mt-1 block font-mono">No active position in {ticker}</span>
        )}
      </div>

      {/* Quantity Selector */}
      <div className="mt-5 space-y-2">
        <label className="text-[10px] font-bold text-panel-subtext uppercase font-mono block">
          Execution Shares Qty:
        </label>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setQty(prev => Math.max(1, prev - 1))}
            className="p-2 border border-panel-border bg-panel-inner-bg hover:bg-panel-border rounded-xl text-panel-heading transition font-bold cursor-pointer"
          >
            <Minus size={14} />
          </button>
          <input
            type="number"
            min={1}
            value={qty}
            onChange={(e) => setQty(Math.max(1, parseInt(e.target.value) || 1))}
            className="flex-1 bg-panel-inner-bg border border-panel-border rounded-xl p-1.5 text-center font-mono font-bold text-panel-heading text-sm focus:outline-none focus:border-indigo-500"
          />
          <button
            type="button"
            onClick={() => setQty(prev => prev + 1)}
            className="p-2 border border-panel-border bg-panel-inner-bg hover:bg-panel-border rounded-xl text-panel-heading transition font-bold cursor-pointer"
          >
            <Plus size={14} />
          </button>
        </div>

        {/* Presets */}
        <div className="grid grid-cols-4 gap-1.5 pt-1">
          {[5, 10, 50, 100].map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => setQty(preset)}
              className="py-1 border border-panel-border text-[10px] font-mono text-panel-subtext hover:text-panel-heading hover:bg-panel-inner-bg rounded-lg transition font-bold cursor-pointer"
            >
              +{preset}
            </button>
          ))}
        </div>
      </div>

      {/* Execution Estimator */}
      <div className="mt-5 p-3.5 bg-panel-border/30 rounded-xl flex items-center justify-between text-xs font-mono">
        <span className="text-panel-subtext">Estimated Order Cost:</span>
        <span className={`font-extrabold ${canAfford ? 'text-panel-heading' : 'text-rose-500'}`}>
          ${orderValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
      </div>
      {!canAfford && (
        <p className="text-[10px] text-rose-500 font-bold mt-1 text-right font-mono">
          ⚠️ Order value exceeds available cash balance!
        </p>
      )}

      {/* Trading Buttons */}
      <div className="mt-6 flex gap-3">
        <button
          type="button"
          onClick={handleBuy}
          disabled={!canAfford}
          className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-bold text-xs transition cursor-pointer shadow-md shadow-emerald-950/20"
        >
          EXECUTE BUY
        </button>
        {position && (
          <button
            type="button"
            onClick={handleSellAll}
            className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition cursor-pointer shadow-md shadow-rose-950/20"
          >
            SELL ALL (Exit)
          </button>
        )}
      </div>
    </motion.div>
  );
}
