import { useEffect, useRef, useState, useMemo, useCallback, memo } from 'react';
import { createChart, ColorType, type IChartApi, type ISeriesApi } from 'lightweight-charts';
import { useAuthStore } from '../../stores/auth-store';
import { useQuotes, useQuote, usePriceHistory, usePortfolio, usePlaceOrder, useTradeHistory, usePendingOrders, useCancelOrder, type Quote, type PriceCandle, type PendingOrder } from '../../api/trading';
import { getSocket, connectSocket } from '../../lib/socket';

// ═══════════════════════════════════════════════
// Color & Style Constants
// ═══════════════════════════════════════════════
const COLORS = {
  bg: '#fff',
  bgAlt: '#f9fafb',
  border: '#e5e7eb',
  text: '#111827',
  textSecondary: '#6b7280',
  up: '#16a34a',
  down: '#dc2626',
  accent: '#2563eb',
  gridLight: '#f3f4f6',
} as const;

// ═══════════════════════════════════════════════
// Compact Row Heights & Paddings
// ═══════════════════════════════════════════════
const COMPACT = {
  rowH: 28,
  tableRowH: 24,
  headerPad: '6px 8px',
  cellPad: '4px 8px',
  labelFontSize: 10,
  valueFontSize: 11,
  priceFontSize: 12,
  font: "'Inter', system-ui, -apple-system, sans-serif",
} as const;

// ═══════════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════════
export default function TradingWindow() {
  const user = useAuthStore((s) => s.user);
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
  const [watchlist, setWatchlist] = useState<Set<string>>(new Set());
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleOrderPlaced = useCallback(() => {
    setRefreshTrigger((prev) => prev + 1);
  }, []);

  const toggleWatchlist = useCallback((symbol: string) => {
    setWatchlist((prev) => {
      const next = new Set(prev);
      if (next.has(symbol)) {
        next.delete(symbol);
      } else {
        next.add(symbol);
      }
      return next;
    });
  }, []);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column' as const,
      height: '100%',
      background: COLORS.bg,
      color: COLORS.text,
      fontFamily: COMPACT.font,
      fontSize: COMPACT.valueFontSize,
    }}>
      {/* Info Bar */}
      {selectedSymbol && <InfoBar symbol={selectedSymbol} />}

      {/* Main Layout */}
      <div style={{
        display: 'flex',
        flex: 1,
        minHeight: 0,
        gap: 0,
      }}>
        {/* Left Sidebar: Asset List */}
        <AssetList
          onSelect={setSelectedSymbol}
          selectedSymbol={selectedSymbol}
          watchlist={watchlist}
          onWatchlistToggle={toggleWatchlist}
        />

        {/* Center: Chart */}
        <ChartPanel symbol={selectedSymbol} />

        {/* Right Panel: Order Book + Order Form */}
        <RightPanel
          symbol={selectedSymbol}
          onOrderPlaced={handleOrderPlaced}
        />
      </div>

      {/* Bottom Tabs: Positions, Pending Orders, Trade History, Asset Allocation */}
      {user && (
        <BottomPanel userId={user.id} refreshTrigger={refreshTrigger} />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════
// Info Bar (Top)
// ═══════════════════════════════════════════════
const InfoBar = memo(({ symbol }: { symbol: string }) => {
  const { data: quoteData } = useQuote(symbol);
  const quote = quoteData;

  if (!quote) {
    return (
      <div style={{
        height: COMPACT.rowH,
        padding: COMPACT.headerPad,
        borderBottom: `1px solid ${COLORS.border}`,
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        backgroundColor: COLORS.bgAlt,
        fontSize: COMPACT.valueFontSize,
      }}>
        Loading...
      </div>
    );
  }

  const isUp = quote.changePercent >= 0;

  return (
    <div style={{
      height: COMPACT.rowH,
      padding: COMPACT.headerPad,
      borderBottom: `1px solid ${COLORS.border}`,
      display: 'flex',
      alignItems: 'center',
      gap: 16,
      backgroundColor: COLORS.bgAlt,
      overflow: 'hidden',
    }}>
      <span style={{ fontWeight: 600, fontSize: COMPACT.valueFontSize }}>
        {symbol}
      </span>
      <span style={{ fontSize: COMPACT.priceFontSize, fontWeight: 600 }}>
        {quote.price.toFixed(0)}
      </span>
      <span style={{ color: isUp ? COLORS.up : COLORS.down, fontSize: COMPACT.valueFontSize, fontWeight: 600 }}>
        {isUp ? '+' : ''}{quote.changePercent.toFixed(2)}%
      </span>
      <span style={{ fontSize: COMPACT.labelFontSize, color: COLORS.textSecondary }}>
        52W: {quote.week52Low?.toFixed(0) ?? '—'} ~ {quote.week52High?.toFixed(0) ?? '—'}
      </span>
      <span style={{ fontSize: COMPACT.labelFontSize, color: COLORS.textSecondary }}>
        Vol: {(quote.volume || 0).toLocaleString()}
      </span>
    </div>
  );
});
InfoBar.displayName = 'InfoBar';

// ═══════════════════════════════════════════════
// Asset List (Left Sidebar)
// ═══════════════════════════════════════════════
const AssetList = memo(({
  onSelect,
  selectedSymbol,
  watchlist,
  onWatchlistToggle,
}: {
  onSelect: (symbol: string) => void;
  selectedSymbol: string | null;
  watchlist: Set<string>;
  onWatchlistToggle: (symbol: string) => void;
}) => {
  const { data, isLoading } = useQuotes();
  const quotes = data?.quotes ?? [];
  const [searchTerm, setSearchTerm] = useState('');

  const filtered = useMemo(() => {
    return quotes.filter(q =>
      q.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
      q.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [quotes, searchTerm]);

  return (
    <div style={{
      width: 160,
      minWidth: 160,
      maxWidth: 160,
      borderRight: `1px solid ${COLORS.border}`,
      display: 'flex',
      flexDirection: 'column' as const,
      background: COLORS.bg,
    }}>
      {/* Header */}
      <div style={{
        padding: COMPACT.headerPad,
        borderBottom: `1px solid ${COLORS.border}`,
        fontSize: COMPACT.labelFontSize,
        fontWeight: 600,
        color: COLORS.textSecondary,
        textTransform: 'uppercase' as const,
        letterSpacing: '0.5px',
        backgroundColor: COLORS.bgAlt,
      }}>
        종목
      </div>

      {/* Search */}
      <div style={{ padding: '4px' }}>
        <input
          type="text"
          placeholder="검색..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{
            width: '100%',
            padding: COMPACT.cellPad,
            border: `1px solid ${COLORS.border}`,
            borderRadius: 2,
            fontSize: COMPACT.valueFontSize,
            boxSizing: 'border-box',
            background: COLORS.bg,
            color: COLORS.text,
          }}
        />
      </div>

      {/* Asset List */}
      <div style={{ flex: 1, overflow: 'auto', padding: '2px' }}>
        {isLoading ? (
          <div style={{ padding: 8, color: COLORS.textSecondary, fontSize: COMPACT.labelFontSize }}>
            로딩...
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 8, color: COLORS.textSecondary, fontSize: COMPACT.labelFontSize }}>
            없음
          </div>
        ) : (
          filtered.map((quote) => {
            const isUp = quote.changePercent >= 0;
            const isSelected = selectedSymbol === quote.symbol;

            return (
              <div
                key={quote.symbol}
                style={{
                  height: COMPACT.rowH,
                  padding: COMPACT.cellPad,
                  marginBottom: 2,
                  background: isSelected ? '#f3f4f6' : 'transparent',
                  border: isSelected ? `1px solid ${COLORS.accent}` : `1px solid transparent`,
                  borderRadius: 2,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  justifyContent: 'space-between',
                  transition: 'all 0.1s ease',
                }}
                onClick={() => onSelect(quote.symbol)}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: COMPACT.valueFontSize, fontWeight: 600, color: COLORS.text }}>
                    {quote.symbol}
                  </div>
                  <div style={{ display: 'flex', gap: 4, fontSize: COMPACT.labelFontSize, color: COLORS.textSecondary }}>
                    <span>{quote.price.toFixed(0)}</span>
                    <span style={{ color: isUp ? COLORS.up : COLORS.down }}>
                      {isUp ? '+' : ''}{quote.changePercent.toFixed(2)}%
                    </span>
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onWatchlistToggle(quote.symbol);
                  }}
                  style={{
                    background: watchlist.has(quote.symbol) ? COLORS.accent : 'transparent',
                    color: watchlist.has(quote.symbol) ? COLORS.bg : COLORS.textSecondary,
                    border: 'none',
                    width: 16,
                    height: 16,
                    borderRadius: 2,
                    cursor: 'pointer',
                    fontSize: 10,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                  title="Watchlist"
                >
                  ★
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
});
AssetList.displayName = 'AssetList';

// ═══════════════════════════════════════════════
// Chart Panel (Center)
// ═══════════════════════════════════════════════
const ChartPanel = memo(({ symbol }: { symbol: string | null }) => {
  const [timeframe, setTimeframe] = useState<'1m' | '5m' | '1h' | '1d'>('1m');

  return (
    <div style={{
      flex: 1,
      minWidth: 0,
      display: 'flex',
      flexDirection: 'column' as const,
      borderRight: `1px solid ${COLORS.border}`,
      background: COLORS.bgAlt,
    }}>
      {/* Timeframe Tabs */}
      <div style={{
        display: 'flex',
        gap: 2,
        padding: COMPACT.headerPad,
        borderBottom: `1px solid ${COLORS.border}`,
        backgroundColor: COLORS.bg,
      }}>
        {(['1m', '5m', '1h', '1d'] as const).map((tf) => (
          <button
            key={tf}
            onClick={() => setTimeframe(tf)}
            style={{
              padding: COMPACT.cellPad,
              background: timeframe === tf ? COLORS.accent : 'transparent',
              color: timeframe === tf ? COLORS.bg : COLORS.textSecondary,
              border: `1px solid ${timeframe === tf ? COLORS.accent : COLORS.border}`,
              borderRadius: 2,
              fontSize: COMPACT.labelFontSize,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.1s ease',
            }}
          >
            {tf}
          </button>
        ))}
      </div>

      {/* Chart */}
      <PriceChart symbol={symbol} timeframe={timeframe} />
    </div>
  );
});
ChartPanel.displayName = 'ChartPanel';

// ═══════════════════════════════════════════════
// Price Chart
// ═══════════════════════════════════════════════
const PriceChart = memo(({
  symbol,
  timeframe,
}: {
  symbol: string | null;
  timeframe: '1m' | '5m' | '1h' | '1d';
}) => {
  const chartContainer = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const lineRef = useRef<ISeriesApi<'Line'> | null>(null);
  const liveCandleRef = useRef<{ time: number; open: number; high: number; low: number; close: number } | null>(null);

  const { data: historyData, isLoading } = usePriceHistory(symbol ?? '', timeframe, 100);

  // Create chart on mount
  useEffect(() => {
    if (!chartContainer.current) return;

    const c = createChart(chartContainer.current, {
      layout: {
        background: { type: ColorType.Solid, color: COLORS.bg },
        textColor: COLORS.textSecondary,
        fontFamily: COMPACT.font,
        fontSize: COMPACT.labelFontSize,
      },
      width: chartContainer.current.clientWidth,
      height: chartContainer.current.clientHeight,
      grid: {
        vertLines: { color: COLORS.gridLight },
        horzLines: { color: COLORS.gridLight },
      },
      timeScale: {
        timeVisible: true,
        secondsVisible: timeframe === '1m',
      },
      crosshair: {
        mode: 0,
      },
    });

    candleRef.current = c.addCandlestickSeries({
      upColor: COLORS.up,
      downColor: COLORS.down,
      wickUpColor: COLORS.up,
      wickDownColor: COLORS.down,
      borderUpColor: COLORS.up,
      borderDownColor: COLORS.down,
    });

    volumeRef.current = c.addHistogramSeries({
      color: COLORS.accent,
      base: 0,
      priceFormat: { type: 'volume' },
      priceScaleId: 'volume',
    });
    c.priceScale('volume').applyOptions({
      scaleMargins: { top: 0.85, bottom: 0 },
    });

    lineRef.current = c.addLineSeries({
      color: COLORS.accent,
      lineWidth: 1,
      priceLineVisible: true,
      lastValueVisible: true,
    });

    chartRef.current = c;

    const ro = new ResizeObserver(() => {
      if (chartContainer.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: chartContainer.current.clientWidth,
          height: chartContainer.current.clientHeight,
        });
      }
    });
    ro.observe(chartContainer.current);

    return () => {
      ro.disconnect();
      c.remove();
      chartRef.current = null;
      candleRef.current = null;
      volumeRef.current = null;
      lineRef.current = null;
    };
  }, []);

  // Load candle data when symbol or timeframe changes
  useEffect(() => {
    if (!candleRef.current || !volumeRef.current) return;

    if (!historyData || historyData.candles.length === 0) {
      candleRef.current.setData([]);
      volumeRef.current.setData([]);
      return;
    }

    const candles = historyData.candles.map((c) => ({
      time: c.timestamp as number,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }));

    const volumes = historyData.candles.map((c) => ({
      time: c.timestamp as number,
      value: c.volume,
      color: c.close >= c.open ? COLORS.up : COLORS.down,
    }));

    candleRef.current.setData(candles);
    volumeRef.current.setData(volumes);
    chartRef.current?.timeScale().fitContent();
    liveCandleRef.current = null;
  }, [historyData, timeframe]);

  // Real-time socket updates
  useEffect(() => {
    if (!symbol) return;

    const socket = getSocket();
    if (!socket.connected) connectSocket();
    socket.emit('price:subscribe');

    const handlePriceUpdate = (quotes: any[]) => {
      const q = Array.isArray(quotes) ? quotes.find((r) => r.symbol === symbol) : null;
      if (!q || !lineRef.current) return;

      const nowSec = Math.floor(q.timestamp / 1000);
      lineRef.current.update({ time: nowSec as any, value: q.price });

      // Update live candle
      const minuteSec = Math.floor(nowSec / 60) * 60;
      const live = liveCandleRef.current;
      if (live && live.time === minuteSec) {
        live.high = Math.max(live.high, q.price);
        live.low = Math.min(live.low, q.price);
        live.close = q.price;
      } else {
        liveCandleRef.current = {
          time: minuteSec,
          open: q.price,
          high: q.price,
          low: q.price,
          close: q.price,
        };
      }
      if (candleRef.current && liveCandleRef.current) {
        candleRef.current.update(liveCandleRef.current as any);
      }
    };

    socket.on('price:update', handlePriceUpdate);
    return () => {
      socket.off('price:update', handlePriceUpdate);
      lineRef.current?.setData([]);
    };
  }, [symbol]);

  if (!symbol) {
    return (
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: COLORS.textSecondary,
        fontSize: COMPACT.valueFontSize,
      }}>
        좌측에서 종목을 선택하세요
      </div>
    );
  }

  return (
    <div style={{
      flex: 1,
      minHeight: 100,
      overflow: 'hidden',
      position: 'relative' as const,
      background: COLORS.bg,
    }}>
      <div ref={chartContainer} style={{
        position: 'absolute' as const,
        inset: 0,
      }} />
      {isLoading && (
        <div style={{
          position: 'absolute' as const,
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: COLORS.textSecondary,
          fontSize: COMPACT.valueFontSize,
          pointerEvents: 'none' as const,
        }}>
          차트 로딩 중...
        </div>
      )}
    </div>
  );
});
PriceChart.displayName = 'PriceChart';

// ═══════════════════════════════════════════════
// Right Panel: Order Book + Order Form
// ═══════════════════════════════════════════════
const RightPanel = memo(({
  symbol,
  onOrderPlaced,
}: {
  symbol: string | null;
  onOrderPlaced: () => void;
}) => {
  return (
    <div style={{
      width: 220,
      minWidth: 220,
      maxWidth: 220,
      borderLeft: `1px solid ${COLORS.border}`,
      display: 'flex',
      flexDirection: 'column' as const,
      background: COLORS.bg,
    }}>
      {/* Order Book */}
      <OrderBook symbol={symbol} />

      {/* Order Form */}
      <OrderForm symbol={symbol} onOrderPlaced={onOrderPlaced} />
    </div>
  );
});
RightPanel.displayName = 'RightPanel';

// ═══════════════════════════════════════════════
// Order Book (호가창)
// ═══════════════════════════════════════════════
const OrderBook = memo(({ symbol }: { symbol: string | null }) => {
  const { data: quoteData } = useQuote(symbol ?? '');
  const quote = quoteData;

  if (!symbol || !quote) {
    return (
      <div style={{
        height: 120,
        padding: COMPACT.headerPad,
        borderBottom: `1px solid ${COLORS.border}`,
        color: COLORS.textSecondary,
        fontSize: COMPACT.labelFontSize,
      }}>
        호가창
      </div>
    );
  }

  // Generate fake order book: 5 levels above and below current price
  const spreadPercent = 0.01; // 1% spread
  const spread = quote.price * spreadPercent;
  const asks = Array.from({ length: 5 }, (_, i) => ({
    price: quote.price + (5 - i) * spread / 5,
    qty: 1000 + Math.random() * 500,
  }));
  const bids = Array.from({ length: 5 }, (_, i) => ({
    price: quote.price - (i + 1) * spread / 5,
    qty: 1000 + Math.random() * 500,
  }));

  return (
    <div style={{
      height: 120,
      padding: COMPACT.headerPad,
      borderBottom: `1px solid ${COLORS.border}`,
      display: 'flex',
      flexDirection: 'column' as const,
      overflow: 'hidden',
    }}>
      <div style={{ fontSize: COMPACT.labelFontSize, fontWeight: 600, color: COLORS.textSecondary, marginBottom: 4 }}>
        호가창
      </div>
      <div style={{ flex: 1, overflow: 'auto', fontSize: COMPACT.labelFontSize }}>
        {/* Asks (red) */}
        {asks.map((ask, i) => (
          <div key={`ask-${i}`} style={{ display: 'flex', justifyContent: 'space-between', color: COLORS.down, marginBottom: 2 }}>
            <span>{ask.price.toFixed(0)}</span>
            <span>{Math.floor(ask.qty)}</span>
          </div>
        ))}

        {/* Current price separator */}
        <div style={{ borderTop: `1px solid ${COLORS.border}`, margin: '2px 0', padding: '2px 0' }} />

        {/* Bids (green) */}
        {bids.map((bid, i) => (
          <div key={`bid-${i}`} style={{ display: 'flex', justifyContent: 'space-between', color: COLORS.up, marginBottom: 2 }}>
            <span>{bid.price.toFixed(0)}</span>
            <span>{Math.floor(bid.qty)}</span>
          </div>
        ))}
      </div>
    </div>
  );
});
OrderBook.displayName = 'OrderBook';

// ═══════════════════════════════════════════════
// Order Form
// ═══════════════════════════════════════════════
const OrderForm = memo(({
  symbol,
  onOrderPlaced,
}: {
  symbol: string | null;
  onOrderPlaced: () => void;
}) => {
  const user = useAuthStore((s) => s.user);
  const { data: quoteData } = useQuote(symbol ?? '');
  const { mutate: placeOrder, isPending, isError, error } = usePlaceOrder();

  const [isBuy, setIsBuy] = useState(true);
  const [orderType, setOrderType] = useState<'시장가' | '지정가' | '손절' | '익절'>('시장가');
  const [quantity, setQuantity] = useState('');
  const [limitPrice, setLimitPrice] = useState('');

  const quote = quoteData;
  const quantityNum = parseInt(quantity, 10) || 0;
  const limitPriceNum = parseFloat(limitPrice) || quote?.price || 0;
  const totalCost = quantityNum * (orderType === '시장가' ? quote?.price ?? 0 : limitPriceNum);
  const availableGold = user?.gold ?? 0;
  const canOrder = quantityNum > 0 && (isBuy ? totalCost <= availableGold : true);

  const handleOrder = () => {
    if (!symbol || !user || quantityNum <= 0) return;

    const limitPriceValue = ['시장가'].includes(orderType) ? undefined : limitPriceNum;

    placeOrder(
      {
        userId: user.id,
        symbol,
        side: isBuy ? 'buy' : 'sell',
        type: ['시장가'].includes(orderType) ? 'market' : 'limit',
        quantity: quantityNum,
        limitPrice: limitPriceValue,
      },
      {
        onSuccess: () => {
          setQuantity('');
          setLimitPrice('');
          onOrderPlaced();
        },
      }
    );
  };

  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column' as const,
      overflow: 'auto',
      borderTop: `1px solid ${COLORS.border}`,
    }}>
      {/* Buy/Sell Tabs */}
      <div style={{
        display: 'flex',
        gap: 2,
        padding: '4px',
        borderBottom: `1px solid ${COLORS.border}`,
        backgroundColor: COLORS.bgAlt,
      }}>
        <button
          onClick={() => setIsBuy(true)}
          style={{
            flex: 1,
            padding: COMPACT.cellPad,
            background: isBuy ? COLORS.up : 'transparent',
            color: isBuy ? COLORS.bg : COLORS.textSecondary,
            border: `1px solid ${isBuy ? COLORS.up : COLORS.border}`,
            borderRadius: 2,
            fontSize: COMPACT.labelFontSize,
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.1s ease',
          }}
        >
          매수
        </button>
        <button
          onClick={() => setIsBuy(false)}
          style={{
            flex: 1,
            padding: COMPACT.cellPad,
            background: !isBuy ? COLORS.down : 'transparent',
            color: !isBuy ? COLORS.bg : COLORS.textSecondary,
            border: `1px solid ${!isBuy ? COLORS.down : COLORS.border}`,
            borderRadius: 2,
            fontSize: COMPACT.labelFontSize,
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.1s ease',
          }}
        >
          매도
        </button>
      </div>

      {!symbol ? (
        <div style={{ padding: 8, color: COLORS.textSecondary, fontSize: COMPACT.labelFontSize }}>
          종목 선택
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' as const, padding: '6px 8px', overflow: 'auto' }}>
          {/* Current Price */}
          <div style={{ marginBottom: 6 }}>
            <div style={{ fontSize: COMPACT.labelFontSize, color: COLORS.textSecondary, marginBottom: 2 }}>
              현재가
            </div>
            <div style={{ fontSize: COMPACT.priceFontSize, fontWeight: 600, color: COLORS.text }}>
              {quote?.price.toFixed(0) ?? '—'}
            </div>
          </div>

          {/* Order Type */}
          <div style={{ marginBottom: 6 }}>
            <div style={{ fontSize: COMPACT.labelFontSize, color: COLORS.textSecondary, marginBottom: 2 }}>
              주문 유형
            </div>
            <select
              value={orderType}
              onChange={(e) => setOrderType(e.target.value as any)}
              style={{
                width: '100%',
                padding: COMPACT.cellPad,
                border: `1px solid ${COLORS.border}`,
                borderRadius: 2,
                fontSize: COMPACT.valueFontSize,
                background: COLORS.bg,
                color: COLORS.text,
                cursor: 'pointer',
              }}
            >
              <option value="시장가">시장가</option>
              <option value="지정가">지정가</option>
              <option value="손절">손절</option>
              <option value="익절">익절</option>
            </select>
          </div>

          {/* Limit Price (if not market) */}
          {orderType !== '시장가' && (
            <div style={{ marginBottom: 6 }}>
              <div style={{ fontSize: COMPACT.labelFontSize, color: COLORS.textSecondary, marginBottom: 2 }}>
                {orderType === '지정가' ? '지정가' : '트리거가'}
              </div>
              <input
                type="number"
                value={limitPrice}
                onChange={(e) => setLimitPrice(e.target.value)}
                placeholder="0"
                style={{
                  width: '100%',
                  padding: COMPACT.cellPad,
                  border: `1px solid ${COLORS.border}`,
                  borderRadius: 2,
                  fontSize: COMPACT.valueFontSize,
                  boxSizing: 'border-box',
                  background: COLORS.bg,
                  color: COLORS.text,
                }}
              />
            </div>
          )}

          {/* Quantity */}
          <div style={{ marginBottom: 6 }}>
            <div style={{ fontSize: COMPACT.labelFontSize, color: COLORS.textSecondary, marginBottom: 2 }}>
              수량
            </div>
            <input
              type="number"
              min="0"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="0"
              style={{
                width: '100%',
                padding: COMPACT.cellPad,
                border: `1px solid ${COLORS.border}`,
                borderRadius: 2,
                fontSize: COMPACT.valueFontSize,
                boxSizing: 'border-box',
                background: COLORS.bg,
                color: COLORS.text,
              }}
            />
          </div>

          {/* Total Cost */}
          <div style={{
            padding: COMPACT.cellPad,
            background: COLORS.bgAlt,
            borderRadius: 2,
            marginBottom: 6,
            fontSize: COMPACT.labelFontSize,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
              <span style={{ color: COLORS.textSecondary }}>총액</span>
              <span style={{ fontWeight: 600 }}>{totalCost.toLocaleString()} 골드</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: COLORS.textSecondary }}>보유</span>
              <span style={{ fontWeight: 600 }}>{availableGold.toLocaleString()} 골드</span>
            </div>
          </div>

          {/* Submit Button */}
          <button
            onClick={handleOrder}
            disabled={!canOrder || isPending}
            style={{
              padding: COMPACT.cellPad,
              background: isPending || !canOrder ? '#d1d5db' : isBuy ? COLORS.up : COLORS.down,
              color: isPending || !canOrder ? '#9ca3af' : COLORS.bg,
              border: 'none',
              borderRadius: 2,
              fontSize: COMPACT.labelFontSize,
              fontWeight: 600,
              cursor: isPending || !canOrder ? 'not-allowed' : 'pointer',
              marginBottom: 6,
              transition: 'all 0.1s ease',
            }}
          >
            {isPending ? '처리중...' : isBuy ? '매수' : '매도'}
          </button>

          {isError && (
            <div style={{
              padding: COMPACT.cellPad,
              background: '#fef2f2',
              color: COLORS.down,
              borderRadius: 2,
              fontSize: COMPACT.labelFontSize,
            }}>
              {error?.message || '주문 실패'}
            </div>
          )}
        </div>
      )}
    </div>
  );
});
OrderForm.displayName = 'OrderForm';

// ═══════════════════════════════════════════════
// Bottom Panel with Tabs
// ═══════════════════════════════════════════════
const BottomPanel = memo(({
  userId,
  refreshTrigger,
}: {
  userId: string;
  refreshTrigger: number;
}) => {
  const [activeTab, setActiveTab] = useState<'positions' | 'pending' | 'history' | 'allocation'>('positions');

  return (
    <div style={{
      height: 160,
      borderTop: `1px solid ${COLORS.border}`,
      display: 'flex',
      flexDirection: 'column' as const,
      overflow: 'hidden',
      background: COLORS.bg,
    }}>
      {/* Tab Bar */}
      <div style={{
        display: 'flex',
        gap: 2,
        padding: '4px',
        borderBottom: `1px solid ${COLORS.border}`,
        backgroundColor: COLORS.bgAlt,
        flexShrink: 0,
      }}>
        {(['positions', 'pending', 'history', 'allocation'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              flex: 1,
              padding: COMPACT.cellPad,
              background: activeTab === tab ? COLORS.accent : 'transparent',
              color: activeTab === tab ? COLORS.bg : COLORS.textSecondary,
              border: `1px solid ${activeTab === tab ? COLORS.accent : COLORS.border}`,
              borderRadius: 2,
              fontSize: COMPACT.labelFontSize,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.1s ease',
              whiteSpace: 'nowrap' as const,
            }}
          >
            {tab === 'positions' && '보유'}
            {tab === 'pending' && '미체결'}
            {tab === 'history' && '이력'}
            {tab === 'allocation' && '자산'}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
        {activeTab === 'positions' && <PositionsTab userId={userId} refreshTrigger={refreshTrigger} />}
        {activeTab === 'pending' && <PendingOrdersTab userId={userId} />}
        {activeTab === 'history' && <TradeHistoryTab userId={userId} />}
        {activeTab === 'allocation' && <AllocationTab userId={userId} />}
      </div>
    </div>
  );
});
BottomPanel.displayName = 'BottomPanel';

// ═══════════════════════════════════════════════
// Positions Tab
// ═══════════════════════════════════════════════
const PositionsTab = memo(({
  userId,
  refreshTrigger,
}: {
  userId: string;
  refreshTrigger: number;
}) => {
  const { data: portfolioData } = usePortfolio(userId);
  const positions = portfolioData?.positions ?? [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column' as const, height: '100%' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        padding: COMPACT.cellPad,
        borderBottom: `1px solid ${COLORS.border}`,
        fontSize: COMPACT.labelFontSize,
        fontWeight: 600,
        color: COLORS.textSecondary,
        backgroundColor: COLORS.bgAlt,
        gap: 4,
      }}>
        <div style={{ flex: 1.2 }}>종목</div>
        <div style={{ flex: 0.8 }}>수량</div>
        <div style={{ flex: 0.8 }}>평가가</div>
        <div style={{ flex: 0.8 }}>수익률</div>
      </div>

      {/* Rows */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {positions.length === 0 ? (
          <div style={{ padding: 8, color: COLORS.textSecondary, fontSize: COMPACT.labelFontSize }}>
            없음
          </div>
        ) : (
          positions.map((pos) => {
            const isProfit = pos.pnlPercent >= 0;
            return (
              <div
                key={pos.symbol}
                style={{
                  display: 'flex',
                  padding: COMPACT.cellPad,
                  borderBottom: `1px solid ${COLORS.border}`,
                  fontSize: COMPACT.labelFontSize,
                  alignItems: 'center',
                  gap: 4,
                  backgroundColor: positions.indexOf(pos) % 2 === 0 ? 'transparent' : COLORS.bgAlt,
                }}
              >
                <div style={{ flex: 1.2, fontWeight: 600 }}>{pos.symbol}</div>
                <div style={{ flex: 0.8 }}>{pos.quantity}</div>
                <div style={{ flex: 0.8 }}>{pos.currentPrice.toFixed(0)}</div>
                <div style={{
                  flex: 0.8,
                  color: isProfit ? COLORS.up : COLORS.down,
                  fontWeight: 600,
                }}>
                  {isProfit ? '+' : ''}{pos.pnlPercent.toFixed(2)}%
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
});
PositionsTab.displayName = 'PositionsTab';

// ═══════════════════════════════════════════════
// Pending Orders Tab
// ═══════════════════════════════════════════════
const PendingOrdersTab = memo(({ userId }: { userId: string }) => {
  const { data: pendingData } = usePendingOrders(userId);
  const { mutate: cancelOrder, isPending: isCancelling } = useCancelOrder();
  const pendingOrders = pendingData?.orders ?? [];

  const getOrderTypeLabel = (type: string): string => {
    switch (type) {
      case 'limit': return '지정가';
      case 'stop_loss': return '손절';
      case 'take_profit': return '익절';
      case 'market': return '시장가';
      default: return type;
    }
  };

  const getSideLabel = (side: string): string => {
    return side === 'buy' ? '매수' : '매도';
  };

  if (pendingOrders.length === 0) {
    return (
      <div style={{
        padding: 8,
        color: COLORS.textSecondary,
        fontSize: COMPACT.labelFontSize,
        textAlign: 'center' as const,
      }}>
        미체결 주문 없음
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column' as const, height: '100%' }}>
      {/* Header */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr 1fr 1fr 1.2fr 0.8fr',
        padding: COMPACT.cellPad,
        borderBottom: `1px solid ${COLORS.border}`,
        fontSize: COMPACT.labelFontSize,
        fontWeight: 600,
        backgroundColor: COLORS.bgAlt,
        gap: 4,
        flexShrink: 0,
      }}>
        <div>종목</div>
        <div>매매</div>
        <div>유형</div>
        <div>수량</div>
        <div>주문가</div>
        <div></div>
      </div>

      {/* Rows */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {pendingOrders.map((order, idx) => (
          <div
            key={order.id}
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 1fr 1fr 1.2fr 0.8fr',
              padding: COMPACT.cellPad,
              height: COMPACT.tableRowH,
              borderBottom: `1px solid ${COLORS.border}`,
              backgroundColor: idx % 2 === 0 ? COLORS.bg : COLORS.bgAlt,
              alignItems: 'center',
              fontSize: COMPACT.valueFontSize,
              gap: 4,
            }}
          >
            <div style={{ fontWeight: 600, color: COLORS.text }}>
              {order.symbol}
            </div>
            <div style={{ color: order.side === 'buy' ? COLORS.up : COLORS.down }}>
              {getSideLabel(order.side)}
            </div>
            <div style={{ color: COLORS.textSecondary }}>
              {getOrderTypeLabel(order.type)}
            </div>
            <div style={{ color: COLORS.text }}>
              {order.quantity.toFixed(0)}
            </div>
            <div style={{ color: COLORS.text, fontWeight: 500 }}>
              {order.type === 'limit' && order.limitPrice
                ? order.limitPrice.toFixed(0)
                : order.type === 'stop_loss' || order.type === 'take_profit'
                ? order.stopPrice?.toFixed(0)
                : '—'}
            </div>
            <button
              onClick={() => cancelOrder(order.id)}
              disabled={isCancelling}
              style={{
                padding: '2px 4px',
                border: `1px solid ${COLORS.down}`,
                background: 'transparent',
                color: COLORS.down,
                borderRadius: 2,
                fontSize: COMPACT.labelFontSize,
                cursor: isCancelling ? 'default' : 'pointer',
                fontWeight: 600,
                opacity: isCancelling ? 0.6 : 1,
              }}
            >
              취소
            </button>
          </div>
        ))}
      </div>
    </div>
  );
});
PendingOrdersTab.displayName = 'PendingOrdersTab';

// ═══════════════════════════════════════════════
// Trade History Tab
// ═══════════════════════════════════════════════
const TradeHistoryTab = memo(({ userId }: { userId: string }) => {
  const { data: historyData } = useTradeHistory(userId);
  const trades = historyData?.trades ?? [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column' as const, height: '100%' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        padding: COMPACT.cellPad,
        borderBottom: `1px solid ${COLORS.border}`,
        fontSize: COMPACT.labelFontSize,
        fontWeight: 600,
        color: COLORS.textSecondary,
        backgroundColor: COLORS.bgAlt,
        gap: 4,
      }}>
        <div style={{ flex: 1 }}>종목</div>
        <div style={{ flex: 0.7 }}>수량</div>
        <div style={{ flex: 0.7 }}>가격</div>
        <div style={{ flex: 0.6 }}>유형</div>
      </div>

      {/* Rows */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {trades.length === 0 ? (
          <div style={{ padding: 8, color: COLORS.textSecondary, fontSize: COMPACT.labelFontSize }}>
            거래 없음
          </div>
        ) : (
          trades.map((trade, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                padding: COMPACT.cellPad,
                borderBottom: `1px solid ${COLORS.border}`,
                fontSize: COMPACT.labelFontSize,
                alignItems: 'center',
                gap: 4,
                backgroundColor: i % 2 === 0 ? 'transparent' : COLORS.bgAlt,
              }}
            >
              <div style={{ flex: 1, fontWeight: 600 }}>{trade.symbol}</div>
              <div style={{ flex: 0.7 }}>{trade.quantity}</div>
              <div style={{ flex: 0.7 }}>{trade.price.toFixed(0)}</div>
              <div style={{
                flex: 0.6,
                color: trade.side === 'buy' ? COLORS.up : COLORS.down,
              }}>
                {trade.side === 'buy' ? '매수' : '매도'}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
});
TradeHistoryTab.displayName = 'TradeHistoryTab';

// ═══════════════════════════════════════════════
// Asset Allocation Tab
// ═══════════════════════════════════════════════
const AllocationTab = memo(({ userId }: { userId: string }) => {
  const user = useAuthStore((s) => s.user);
  const { data: portfolioData } = usePortfolio(userId);
  const positions = portfolioData?.positions ?? [];

  const totalPositionValue = positions.reduce((sum, pos) => sum + pos.currentPrice * pos.quantity, 0);
  const totalValue = (user?.gold ?? 0) + totalPositionValue;
  const cashPercent = totalValue > 0 ? ((user?.gold ?? 0) / totalValue) * 100 : 0;
  const positionPercent = 100 - cashPercent;

  return (
    <div style={{ padding: '6px 8px', display: 'flex', flexDirection: 'column' as const, gap: 8 }}>
      {/* Cash Bar */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2, fontSize: COMPACT.labelFontSize }}>
          <span style={{ color: COLORS.textSecondary }}>현금</span>
          <span style={{ fontWeight: 600 }}>{(user?.gold ?? 0).toLocaleString()}</span>
        </div>
        <div style={{
          width: '100%',
          height: 8,
          background: COLORS.border,
          borderRadius: 2,
          overflow: 'hidden',
        }}>
          <div style={{
            width: `${cashPercent}%`,
            height: '100%',
            background: COLORS.accent,
          }} />
        </div>
        <div style={{ fontSize: 9, color: COLORS.textSecondary, marginTop: 1 }}>
          {cashPercent.toFixed(1)}%
        </div>
      </div>

      {/* Position Bar */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2, fontSize: COMPACT.labelFontSize }}>
          <span style={{ color: COLORS.textSecondary }}>종목</span>
          <span style={{ fontWeight: 600 }}>{totalPositionValue.toLocaleString()}</span>
        </div>
        <div style={{
          width: '100%',
          height: 8,
          background: COLORS.border,
          borderRadius: 2,
          overflow: 'hidden',
        }}>
          <div style={{
            width: `${positionPercent}%`,
            height: '100%',
            background: COLORS.up,
          }} />
        </div>
        <div style={{ fontSize: 9, color: COLORS.textSecondary, marginTop: 1 }}>
          {positionPercent.toFixed(1)}%
        </div>
      </div>

      {/* Total */}
      <div style={{
        padding: '4px 6px',
        background: COLORS.bgAlt,
        borderRadius: 2,
        marginTop: 4,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: COMPACT.labelFontSize }}>
          <span style={{ color: COLORS.textSecondary }}>총자산</span>
          <span style={{ fontWeight: 600 }}>{totalValue.toLocaleString()}</span>
        </div>
      </div>
    </div>
  );
});
AllocationTab.displayName = 'AllocationTab';
