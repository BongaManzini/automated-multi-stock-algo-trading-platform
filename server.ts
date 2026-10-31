import express from 'express';
import http from 'http';
import { WebSocketServer, WebSocket as WSWebSocket } from 'ws';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const server = http.createServer(app);
const PORT = 3000;

app.use(express.json());

// API routes first
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    environment: process.env.NODE_ENV || 'development',
    alpacaConfigured: !!(process.env.ALPACA_API_KEY_ID && process.env.ALPACA_API_SECRET_KEY),
    polygonConfigured: !!process.env.POLYGON_API_KEY
  });
});

// GET Historical Market Data from Alpaca/Polygon or fallback simulated walks
// GET Historical Market Data from Alpaca/Polygon or fallback simulated walks
app.get('/api/market/history', async (req, res) => {
  const { ticker = 'AAPL', timeframe = '5m', limit = '150' } = req.query;
  const symbol = String(ticker).toUpperCase();
  const requestedLimit = Math.min(parseInt(String(limit), 10) || 150, 500);

  const alpacaKeyId = process.env.ALPACA_API_KEY_ID;
  const alpacaSecret = process.env.ALPACA_API_SECRET_KEY;

  const isAlpacaActive = alpacaKeyId && alpacaSecret && 
                        !alpacaKeyId.includes('your_') && 
                        !alpacaSecret.includes('your_');

  if (isAlpacaActive) {
    try {
      console.log(`[MarketProxy] Fetching real history for ${symbol} via Alpaca API...`);
      let alpacaTf = '5Min';
      if (timeframe === '1m') alpacaTf = '1Min';
      if (timeframe === '5m') alpacaTf = '5Min';
      if (timeframe === '15m') alpacaTf = '15Min';
      if (timeframe === '1h') alpacaTf = '1Hour';
      if (timeframe === '1d') alpacaTf = '1Day';

      const isCrypto = symbol.includes('BTC') || symbol.includes('ETH') || (symbol.includes('USD') && !['AAPL', 'MSFT', 'TSLA', 'NVDA', 'AMZN'].includes(symbol));
      let alpacaSymbol = symbol;
      if (symbol === 'BTC_USD') {
        alpacaSymbol = 'BTC/USD';
      } else if (symbol === 'ETH_USD') {
        alpacaSymbol = 'ETH/USD';
      }

      const url = isCrypto
        ? `https://data.alpaca.markets/v1beta3/crypto/us/bars?symbols=${encodeURIComponent(alpacaSymbol)}&timeframe=${alpacaTf}&limit=${requestedLimit}`
        : `https://data.alpaca.markets/v2/stocks/bars?symbols=${symbol}&timeframe=${alpacaTf}&limit=${requestedLimit}&adjustment=all&feed=iex`;

      const response = await fetch(url, {
        headers: {
          'APCA-API-KEY-ID': alpacaKeyId!,
          'APCA-API-SECRET-KEY': alpacaSecret!
        }
      });

      if (response.ok) {
        const data = await response.json();
        const rawBars = data.bars?.[alpacaSymbol] || data.bars?.[symbol] || [];

        if (rawBars && rawBars.length > 0) {
          const mappedBars = rawBars.map((b: any) => ({
            time: new Date(b.t).toISOString(),
            open: Number(b.o),
            high: Number(b.h),
            low: Number(b.l),
            close: Number(b.c),
            volume: Number(b.v)
          }));

          return res.json({ provider: 'alpaca', symbol, bars: mappedBars });
        } else {
          console.warn(`[MarketProxy] Alpaca returned 0 bars for ${symbol}. Falling back to simulation engine.`);
        }
      } else {
        const errorText = await response.text();
        console.warn(`[MarketProxy] Alpaca API status ${response.status}: ${errorText || response.statusText}. Falling back to simulation engine.`);
      }
    } catch (error: any) {
      console.warn(`[MarketProxy] Connection error to Alpaca for ${symbol}: ${error.message}. Falling back to simulation engine.`);
    }
  }

  // Fallback: Generate realistic high-precision market bars
  console.log(`[MarketProxy] Serving synthetic bars for ${symbol}...`);
  const fallbackBars = generateRealisticHistory(symbol, requestedLimit);
  return res.json({ provider: 'simulated_fallback', symbol, bars: fallbackBars });
});

// Helper: Generate realistic stock historical prices
function generateRealisticHistory(symbol: string, length: number) {
  // Setup baseline stock prices
  const basePrices: Record<string, number> = {
    AAPL: 180.50,
    MSFT: 420.20,
    TSLA: 175.80,
    NVDA: 950.40,
    BTC: 67000.00,
    BTC_USD: 67000.00,
    ETH: 3500.00,
    ETH_USD: 3500.00,
    AMZN: 185.10,
    META: 470.60,
    NFLX: 610.30,
    GOOGL: 172.40
  };

  const startPrice = basePrices[symbol] || 100.00;
  const bars: any[] = [];
  let currentClose = startPrice;
  const now = new Date();
  
  // Backdate bars
  for (let i = length - 1; i >= 0; i--) {
    const time = new Date(now.getTime() - i * 5 * 60 * 1000).toISOString();
    
    // Random walk with slight upward drift
    const changePercent = (Math.random() - 0.48) * 0.008; // -0.38% to +0.42%
    const open = currentClose * (1 + (Math.random() - 0.5) * 0.001);
    const close = open * (1 + changePercent);
    const high = Math.max(open, close) * (1 + Math.random() * 0.003);
    const low = Math.min(open, close) * (1 - Math.random() * 0.003);
    const volume = Math.floor(Math.random() * 50000) + 10000;

    bars.push({ time, open, high, low, close, volume });
    currentClose = close;
  }

  return bars;
}

// ============================================================================
// Websocket Server Setup (Live Market stream bridge)
// ============================================================================
const wss = new WebSocketServer({ noServer: true });

// Setup upgrade handler for WS
server.on('upgrade', (request, socket, head) => {
  const url = request.url || '';
  if (url.includes('/api/market/stream')) {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  }
});

wss.on('connection', (ws: any, request) => {
  console.log('[WSProxy] Frontend connected to Live Stream bridge');
  let activeTicker = 'AAPL';
  let liveTimer: NodeJS.Timeout | null = null;
  let alpacaWS: any = null;

  const alpacaKeyId = process.env.ALPACA_API_KEY_ID;
  const alpacaSecret = process.env.ALPACA_API_SECRET_KEY;
  const isAlpacaActive = alpacaKeyId && alpacaSecret && 
                        !alpacaKeyId.includes('your_') && 
                        !alpacaSecret.includes('your_');

  // Helper to cleanup resources on socket close
  const cleanup = () => {
    if (liveTimer) {
      clearInterval(liveTimer);
      liveTimer = null;
    }
    if (alpacaWS) {
      try {
        alpacaWS.close();
      } catch (err) {}
      alpacaWS = null;
    }
  };

  ws.on('close', () => {
    console.log('[WSProxy] Frontend disconnected');
    cleanup();
  });

  ws.on('error', (err: any) => {
    console.error('[WSProxy] Socket error:', err.message);
    cleanup();
  });

  // Handle messages from client (e.g. subscribe to ticker)
  ws.on('message', (message: string) => {
    try {
      const data = JSON.parse(message);
      if (data.action === 'subscribe') {
        activeTicker = (data.ticker || 'AAPL').toUpperCase();
        console.log(`[WSProxy] Subscribing to: ${activeTicker}`);
        
        // Reset connection on subscription shift
        cleanup();

        if (isAlpacaActive) {
          setupAlpacaStream(activeTicker);
        } else {
          setupSimulationStream(activeTicker);
        }
      }
    } catch (err: any) {
      console.error('[WSProxy] Message parsing error:', err.message);
    }
  });

  // Flow A: Setup real-time Alpaca WebSocket stream
  const setupAlpacaStream = (symbol: string) => {
    console.log(`[WSProxy] Connecting to Alpaca real-time feed for ${symbol}...`);
    try {
      const isCrypto = symbol.includes('BTC') || symbol.includes('ETH') || (symbol.includes('USD') && !['AAPL', 'MSFT', 'TSLA', 'NVDA', 'AMZN'].includes(symbol));
      let alpacaSymbol = symbol;
      if (symbol === 'BTC_USD') {
        alpacaSymbol = 'BTC/USD';
      } else if (symbol === 'ETH_USD') {
        alpacaSymbol = 'ETH/USD';
      }

      const streamUrl = isCrypto 
        ? 'wss://stream.data.alpaca.markets/v1beta3/crypto/us' 
        : 'wss://stream.data.alpaca.markets/v2/iex';

      alpacaWS = new WSWebSocket(streamUrl);

      alpacaWS.on('open', () => {
        console.log('[WSProxy] Alpaca WS connected. Authenticating...');
      });

      alpacaWS.on('message', (dataStr: string) => {
        try {
          const msgs = JSON.parse(dataStr);
          for (const msg of msgs) {
            // 1. Handle initial connection verification
            if (msg.msg === 'connected') {
              alpacaWS.send(JSON.stringify({
                action: 'auth',
                key: alpacaKeyId,
                secret: alpacaSecret
              }));
            }
            // 2. Handle successful authorization -> Subscribe to minute bars & trades
            else if (msg.msg === 'authenticated') {
              console.log('[WSProxy] Alpaca WS authorized. Subscribing to bars...');
              alpacaWS.send(JSON.stringify({
                action: 'subscribe',
                bars: [alpacaSymbol],
                trades: [alpacaSymbol]
              }));
            }
            // 3. Handle stream payloads
            else if (msg.T === 'b' || msg.T === 't') {
              // Pipe real-time packet to the browser client
              if (ws.readyState === WSWebSocket.OPEN) {
                ws.send(JSON.stringify({
                  type: 'live',
                  ticker: symbol,
                  price: Number(msg.c || msg.p), // c for bar close, p for trade price
                  volume: Number(msg.v || msg.s), // v for bar volume, s for trade size
                  timestamp: msg.t,
                  data: msg
                }));
              }
            }
          }
        } catch (err: any) {
          console.error('[WSProxy] Alpaca stream processing error:', err.message);
        }
      });

      alpacaWS.on('error', (err: any) => {
        console.error('[WSProxy] Alpaca WS error:', err.message);
        setupSimulationStream(symbol); // Fallback to simulated on WS disconnect
      });

      alpacaWS.on('close', () => {
        console.log('[WSProxy] Alpaca WS connection closed');
      });
    } catch (error: any) {
      console.error('[WSProxy] Could not open Alpaca WS:', error.message);
      setupSimulationStream(symbol);
    }
  };

  // Flow B: High-Fidelity Simulation Stream (fallback)
  const setupSimulationStream = (symbol: string) => {
    const basePrices: Record<string, number> = {
      AAPL: 180.50, MSFT: 420.20, TSLA: 175.80, NVDA: 950.40,
      BTC: 67000.00, BTC_USD: 67000.00, ETH: 3500.00, ETH_USD: 3500.00,
      AMZN: 185.10, META: 470.60, NFLX: 610.30, GOOGL: 172.40
    };

    let lastPrice = basePrices[symbol] || 100.00;

    // Send mock ticks every 1 second
    liveTimer = setInterval(() => {
      const change = (Math.random() - 0.495) * 0.001; // subtle walk with slight drift
      lastPrice = lastPrice * (1 + change);
      const volume = Math.floor(Math.random() * 200) + 10;
      
      if (ws.readyState === WSWebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'live',
          ticker: symbol,
          price: Number(lastPrice.toFixed(2)),
          volume,
          timestamp: new Date().toISOString()
        }));
      }
    }, 1000);
  };
});

// ============================================================================
// Express Production Asset Bundling & Fallbacks
// ============================================================================
if (process.env.NODE_ENV !== 'production') {
  createViteServer({
    server: { middlewareMode: true },
    appType: 'spa'
  }).then((vite) => {
    app.use(vite.middlewares);
    
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`[DevServer] Full-Stack Running on http://localhost:${PORT}`);
    });
  });
} else {
  const distPath = path.join(process.cwd(), 'dist');
  app.use(express.static(distPath));
  
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[ProdServer] Full-Stack Running on port ${PORT}`);
  });
}
