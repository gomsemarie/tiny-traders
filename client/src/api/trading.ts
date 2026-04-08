import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from './query-keys';

const API_BASE = '/api';

// ═══════════════════════════════════════════════
// Helper: Get auth token
// ═══════════════════════════════════════════════
function getAuthHeader() {
  const token = localStorage.getItem('tt_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// ═══════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════
export interface Quote {
  symbol: string;
  name: string;
  price: number;
  changePercent: number;
  change: number;
  open?: number;
  high?: number;
  low?: number;
  volume?: number;
  week52High?: number;
  week52Low?: number;
  timestamp: number;
}

export interface PriceCandle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface Position {
  symbol: string;
  quantity: number;
  averagePrice: number;
  currentPrice: number;
  pnlPercent: number;
  pnlValue: number;
}

export interface Portfolio {
  userId: string;
  gold: number;
  totalValue: number;
  pnl: number;
  positions: Position[];
}

export interface Trade {
  id: string;
  symbol: string;
  side: 'buy' | 'sell';
  quantity: number;
  price: number;
  total: number;
  timestamp: number;
  orderId: string;
}

export interface PendingOrder {
  id: string;
  symbol: string;
  side: 'buy' | 'sell';
  type: 'market' | 'limit' | 'stop_loss' | 'take_profit' | 'oco';
  quantity: number;
  limitPrice?: number;
  stopPrice?: number;
  status: 'pending' | 'filled' | 'cancelled' | 'expired';
  createdAt: number;
}

// ═══════════════════════════════════════════════
// Queries
// ═══════════════════════════════════════════════

/** Fetch all tradable quotes (refetch every 5s) */
export function useQuotes() {
  return useQuery({
    queryKey: queryKeys.quotes.all,
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/quotes`, {
        headers: getAuthHeader(),
      });
      if (!res.ok) throw new Error('Failed to fetch quotes');
      return res.json() as Promise<{ quotes: Quote[] }>;
    },
    refetchInterval: 5000,
  });
}

/** Fetch single quote */
export function useQuote(symbol: string) {
  return useQuery({
    queryKey: queryKeys.quotes.detail(symbol),
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/quote/${symbol}`, {
        headers: getAuthHeader(),
      });
      if (!res.ok) throw new Error(`Failed to fetch quote for ${symbol}`);
      return res.json() as Promise<Quote>;
    },
    enabled: !!symbol,
    refetchInterval: 5000,
  });
}

/** Fetch price history (OHLC candles) */
export function usePriceHistory(symbol: string, interval: string = '1m', limit: number = 100) {
  return useQuery({
    queryKey: queryKeys.priceHistory.detail(symbol, interval, limit),
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/prices/history/${symbol}?interval=${interval}&limit=${limit}`, {
        headers: getAuthHeader(),
      });
      if (!res.ok) throw new Error(`Failed to fetch price history for ${symbol}`);
      return res.json() as Promise<{ candles: PriceCandle[] }>;
    },
    enabled: !!symbol,
    refetchInterval: 30000, // Refetch every 30s to pick up new candles
  });
}

/** Fetch user's portfolio */
export function usePortfolio(userId: string) {
  return useQuery({
    queryKey: queryKeys.portfolio.user(userId),
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/portfolio/${userId}`, {
        headers: getAuthHeader(),
      });
      if (!res.ok) throw new Error('Failed to fetch portfolio');
      return res.json() as Promise<Portfolio>;
    },
    enabled: !!userId,
    refetchInterval: 5000,
  });
}

/** Fetch trade history */
export function useTradeHistory(userId: string, limit: number = 20) {
  return useQuery({
    queryKey: queryKeys.tradeHistory.user(userId, limit),
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/portfolio/${userId}/trades?limit=${limit}`, {
        headers: getAuthHeader(),
      });
      if (!res.ok) throw new Error('Failed to fetch trade history');
      return res.json() as Promise<{ trades: Trade[] }>;
    },
    enabled: !!userId,
  });
}

/** Fetch pending orders */
export function usePendingOrders(userId: string) {
  return useQuery({
    queryKey: queryKeys.pendingOrders.user(userId),
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/orders/pending/${userId}`, {
        headers: getAuthHeader(),
      });
      if (!res.ok) throw new Error('Failed to fetch pending orders');
      return res.json() as Promise<{ orders: PendingOrder[] }>;
    },
    enabled: !!userId,
    refetchInterval: 3000,
  });
}

// ═══════════════════════════════════════════════
// Mutations
// ═══════════════════════════════════════════════

export interface PlaceOrderInput {
  userId: string;
  symbol: string;
  side: 'buy' | 'sell';
  type: 'market' | 'limit';
  quantity: number;
  limitPrice?: number;
}

export interface PlaceOrderResult {
  orderId: string;
  symbol: string;
  side: string;
  quantity: number;
  price: number;
  status: string;
  timestamp: number;
}

/** Place an order (market or limit) */
export function usePlaceOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: PlaceOrderInput) => {
      const res = await fetch(`${API_BASE}/order/place`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeader(),
        },
        body: JSON.stringify(input),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Failed to place order');
      }
      return res.json() as Promise<PlaceOrderResult>;
    },
    onSuccess: (_, input) => {
      // Invalidate portfolio, trades, and pending orders
      qc.invalidateQueries({ queryKey: queryKeys.portfolio.user(input.userId) });
      qc.invalidateQueries({ queryKey: queryKeys.tradeHistory.user(input.userId) });
      qc.invalidateQueries({ queryKey: queryKeys.pendingOrders.user(input.userId) });
      // Invalidate quote for this symbol
      qc.invalidateQueries({ queryKey: queryKeys.quotes.detail(input.symbol) });
    },
  });
}

/** Cancel a pending order */
export function useCancelOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (orderId: string) => {
      const res = await fetch(`${API_BASE}/order/${orderId}/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeader(),
        },
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Failed to cancel order');
      }
      return res.json() as Promise<{ success: boolean }>;
    },
    onSuccess: (_, orderId) => {
      // Invalidate all pending orders queries
      qc.invalidateQueries({ queryKey: queryKeys.pendingOrders.all });
    },
  });
}
