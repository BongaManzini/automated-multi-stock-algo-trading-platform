import { db } from './firebase';
import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  collection, 
  getDocs, 
  addDoc, 
  deleteDoc, 
  query, 
  orderBy, 
  limit, 
  writeBatch 
} from 'firebase/firestore';
import { Portfolio, Position, Strategy, Order, BrokerConfig, AgentLog } from '../types';
import { PriceAlert } from '../App';

// Setup Default State for a New User
const DEFAULT_PORTFOLIO: Portfolio = {
  cash: 100000.00,
  initialBalance: 100000.00,
  realizedPnL: 0.00,
  is_live: false
};

const DEFAULT_STRATEGY: Strategy = {
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
};

const DEFAULT_BROKER: BrokerConfig = {
  provider: 'alpaca',
  apiKey: '',
  apiSecret: '',
  isLive: false,
  baseUrl: 'https://paper-api.alpaca.markets'
};

// Main load function
export async function loadUserTerminalData(userId: string) {
  try {
    // 1. Portfolio & Positions
    const portfolioDocRef = doc(db, 'users', userId, 'portfolio', 'state');
    const portfolioDocSnap = await getDoc(portfolioDocRef);
    let portfolio = DEFAULT_PORTFOLIO;
    let positions: Position[] = [];

    if (portfolioDocSnap.exists()) {
      const data = portfolioDocSnap.data();
      portfolio = {
        cash: data.cash ?? DEFAULT_PORTFOLIO.cash,
        initialBalance: data.initialBalance ?? DEFAULT_PORTFOLIO.initialBalance,
        realizedPnL: data.realizedPnL ?? DEFAULT_PORTFOLIO.realizedPnL,
        is_live: data.is_live ?? DEFAULT_PORTFOLIO.is_live,
      };
      positions = data.positions ?? [];
    } else {
      // First time initialization
      await setDoc(portfolioDocRef, {
        ...DEFAULT_PORTFOLIO,
        positions: []
      });
    }

    // 2. Strategy Config
    const strategyDocRef = doc(db, 'users', userId, 'strategy', 'active');
    const strategyDocSnap = await getDoc(strategyDocRef);
    let strategy = DEFAULT_STRATEGY;

    if (strategyDocSnap.exists()) {
      strategy = strategyDocSnap.data() as Strategy;
    } else {
      await setDoc(strategyDocRef, DEFAULT_STRATEGY);
    }

    // 3. Broker Config
    const brokerDocRef = doc(db, 'users', userId, 'config', 'broker');
    const brokerDocSnap = await getDoc(brokerDocRef);
    let brokerConfig = DEFAULT_BROKER;

    if (brokerDocSnap.exists()) {
      brokerConfig = brokerDocSnap.data() as BrokerConfig;
    } else {
      await setDoc(brokerDocRef, DEFAULT_BROKER);
    }

    // 4. Historical Orders
    const ordersColRef = collection(db, 'users', userId, 'orders');
    const ordersQuery = query(ordersColRef, orderBy('timestamp', 'desc'), limit(150));
    const ordersSnap = await getDocs(ordersQuery);
    const orders: Order[] = [];
    ordersSnap.forEach((docSnap) => {
      orders.push({ id: docSnap.id, ...docSnap.data() } as Order);
    });

    // 5. Active Price Alerts
    const alertsColRef = collection(db, 'users', userId, 'alerts');
    const alertsSnap = await getDocs(alertsColRef);
    const alerts: PriceAlert[] = [];
    alertsSnap.forEach((docSnap) => {
      alerts.push({ id: docSnap.id, ...docSnap.data() } as PriceAlert);
    });

    // 6. Audit Logs
    const logsDocRef = doc(db, 'users', userId, 'logs', 'audit');
    const logsDocSnap = await getDoc(logsDocRef);
    let logs: AgentLog[] = [];
    if (logsDocSnap.exists()) {
      logs = logsDocSnap.data().logs ?? [];
    }

    return {
      portfolio,
      positions,
      strategy,
      brokerConfig,
      orders,
      alerts,
      logs
    };
  } catch (error) {
    console.error('Error loading user data from Firestore:', error);
    throw error;
  }
}

// Save Portfolio State (Balance & Holding Positions)
export async function savePortfolioState(userId: string, portfolio: Portfolio, positions: Position[]) {
  try {
    const docRef = doc(db, 'users', userId, 'portfolio', 'state');
    await setDoc(docRef, {
      ...portfolio,
      positions,
      updatedAt: new Date().toISOString()
    }, { merge: true });
  } catch (error) {
    console.error('Error saving portfolio state:', error);
  }
}

// Save Active Strategy Parameters
export async function saveActiveStrategy(userId: string, strategy: Strategy) {
  try {
    const docRef = doc(db, 'users', userId, 'strategy', 'active');
    await setDoc(docRef, {
      ...strategy,
      updatedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error saving active strategy:', error);
  }
}

// Save Broker Configuration (e.g. Alpaca Credentials)
export async function saveBrokerConfig(userId: string, brokerConfig: BrokerConfig) {
  try {
    const docRef = doc(db, 'users', userId, 'config', 'broker');
    await setDoc(docRef, {
      ...brokerConfig,
      updatedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error saving broker config:', error);
  }
}

// Record an executed or pending Order
export async function saveOrderRecord(userId: string, order: Order) {
  try {
    const docRef = doc(db, 'users', userId, 'orders', order.id);
    await setDoc(docRef, {
      ...order,
      createdAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error saving order record:', error);
  }
}

// Save active price alerts (batch / individual)
export async function saveAlertRecord(userId: string, alert: PriceAlert) {
  try {
    const docRef = doc(db, 'users', userId, 'alerts', alert.id);
    await setDoc(docRef, alert);
  } catch (error) {
    console.error('Error saving alert record:', error);
  }
}

// Delete alert when triggered/acknowledged or deleted
export async function deleteAlertRecord(userId: string, alertId: string) {
  try {
    const docRef = doc(db, 'users', userId, 'alerts', alertId);
    await deleteDoc(docRef);
  } catch (error) {
    console.error('Error deleting alert record:', error);
  }
}

// Sync bulk alerts
export async function syncAllAlerts(userId: string, alerts: PriceAlert[]) {
  try {
    // Overwrite the alerts collection (using batch for safety and speed)
    const batch = writeBatch(db);
    
    // First read all existing alerts to clear them or just overwrite/update
    const alertsColRef = collection(db, 'users', userId, 'alerts');
    const currentSnap = await getDocs(alertsColRef);
    currentSnap.forEach((docSnap) => {
      batch.delete(docSnap.ref);
    });

    alerts.forEach((alert) => {
      const newDocRef = doc(db, 'users', userId, 'alerts', alert.id);
      batch.set(newDocRef, alert);
    });

    await batch.commit();
  } catch (error) {
    console.error('Error syncing alerts:', error);
  }
}

// Save sliding window of Agent Audit Logs
export async function saveAuditLogs(userId: string, logs: AgentLog[]) {
  try {
    const docRef = doc(db, 'users', userId, 'logs', 'audit');
    // Save only the most recent 60 logs to Firestore to avoid heavy documents
    const slicedLogs = logs.slice(0, 60);
    await setDoc(docRef, {
      logs: slicedLogs,
      updatedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error saving audit logs:', error);
  }
}
