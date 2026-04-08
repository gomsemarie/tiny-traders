import { useEffect, useRef, useState, useMemo, useCallback, memo } from 'react';
import { createChart, ColorType, type IChartApi, type ISeriesApi } from 'lightweight-charts';
import { Icon } from '@iconify/react';
import { useAuthStore } from '../../stores/auth-store';
import { useQuotes, useQuote, usePriceHistory, usePortfolio, usePlaceOrder, useTradeHistory, usePendingOrders, useCancelOrder, type Quote, type PriceCandle, type PendingOrder } from '../../api/trading';
import { getSocket, connectSocket } from '../../lib/socket';

// ═══════════════════════════════════════════════
// Design Tokens — Modern Light
// ═══════════════════════════════════════════════
const C = {
  // Backgrounds
  bg: '#ffffff',
  bgDeep: '#f7f8fa',
  bgSurface: '#f1f3f6',
  bgHover: '#e8ebf0',
  bgInput: '#ffffff',

  // Borders
  border: '#e2e5ea',
  borderLight: '#cdd1d8',
  borderGold: '#3b82f6',

  // Text
  text: '#1e2028',
  textMuted: '#6b7280',
  textDim: '#9ca3af',
  gold: '#3b82f6',
  goldBright: '#2563eb',

  // Trading
  up: '#10b981',
  upSoft: '#059669',
  upBg: 'rgba(16, 185, 129, 0.08)',
  down: '#ef4444',
  downSoft: '#dc2626',
  downBg: 'rgba(239, 68, 68, 0.08)',

  // Chart
  chartBg: '#ffffff',
  chartGrid: '#f3f4f6',
  chartCrosshair: '#9ca3af',

  // Misc
  font: "'Gothic A1', sans-serif",
  fontDisplay: "'Gothic A1', sans-serif",
} as const;

const S = {
  rowH: 30,
  tableRowH: 26,
  headerPad: '6px 10px',
  cellPad: '4px 8px',
  label: 10,
  value: 11,
  price: 13,
  radius: 4,
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
      if (next.has(symbol)) next.delete(symbol);
      else next.add(symbol);
      return next;
    });
  }, []);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      background: C.bg,
      color: C.text,
      fontFamily: C.font,
      fontSize: S.value,
    }}>
      {/* Info Bar */}
      {selectedSymbol && <InfoBar symbol={selectedSymbol} />}

      {/* Main Layout */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <LeftPanel
          selectedSymbol={selectedSymbol}
          onSelect={setSelectedSymbol}
          watchlist={watchlist}
          onWatchlistToggle={toggleWatchlist}
        />
        <ChartPanel symbol={selectedSymbol} />
        <RightPanel symbol={selectedSymbol} onOrderPlaced={handleOrderPlaced} />
      </div>

      {/* Bottom Tabs */}
      {user && <BottomPanel userId={user.id} refreshTrigger={refreshTrigger} />}
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
        height: S.rowH,
        padding: S.headerPad,
        borderBottom: `1px solid ${C.border}`,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        background: C.bgSurface,
        fontSize: S.value,
        color: C.textMuted,
      }}>
        <Icon icon="tabler:loader-2" width={14} style={{ animation: 'spin 1s linear infinite' }} />
        불러오는 중...
      </div>
    );
  }

  const isUp = quote.changePercent >= 0;
  const changeColor = isUp ? C.up : C.down;

  return (
    <div style={{
      height: 36,
      padding: '0 12px',
      borderBottom: `1px solid ${C.border}`,
      display: 'flex',
      alignItems: 'center',
      gap: 16,
      background: `linear-gradient(180deg, ${C.bgSurface}, ${C.bg})`,
      overflow: 'hidden',
      flexShrink: 0,
    }}>
      {/* Symbol */}
      <span style={{
        fontFamily: C.fontDisplay,
        fontSize: 14,
        color: C.gold,
        letterSpacing: 0.5,
      }}>
        {symbol}
      </span>

      {/* Price */}
      <span style={{
        fontSize: 16,
        fontWeight: 700,
        color: C.text,
        fontVariantNumeric: 'tabular-nums',
      }}>
        {quote.price.toLocaleString(undefined, { maximumFractionDigits: 0 })}
      </span>

      {/* Change */}
      <span style={{
        fontSize: S.value,
        fontWeight: 600,
        color: changeColor,
        background: isUp ? C.upBg : C.downBg,
        padding: '2px 6px',
        borderRadius: S.radius,
        display: 'flex',
        alignItems: 'center',
        gap: 3,
      }}>
        <Icon icon={isUp ? 'tabler:trending-up' : 'tabler:trending-down'} width={12} />
        {isUp ? '+' : ''}{quote.changePercent.toFixed(2)}%
      </span>

      {/* 52W Range */}
      <span style={{ fontSize: S.label, color: C.textDim, display: 'flex', alignItems: 'center', gap: 4 }}>
        <Icon icon="tabler:chart-bar" width={11} />
        52W: {quote.week52Low?.toFixed(0) ?? '—'} ~ {quote.week52High?.toFixed(0) ?? '—'}
      </span>

      {/* Volume */}
      <span style={{ fontSize: S.label, color: C.textDim, display: 'flex', alignItems: 'center', gap: 4 }}>
        <Icon icon="tabler:activity" width={11} />
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
  const [showWatchlistOnly, setShowWatchlistOnly] = useState(false);

  const filtered = useMemo(() => {
    let list = quotes.filter(q =>
      q.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
      q.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
    if (showWatchlistOnly) {
      list = list.filter(q => watchlist.has(q.symbol));
    }
    return list;
  }, [quotes, searchTerm, showWatchlistOnly, watchlist]);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      flex: 1,
      minHeight: 0,
    }}>
      {/* Search + Filter */}
      <div style={{ padding: '4px 6px', display: 'flex', alignItems: 'center', gap: 4 }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Icon icon="tabler:search" width={11} style={{
            position: 'absolute', left: 7, top: '50%', transform: 'translateY(-50%)', color: C.textDim,
          }} />
          <input
            type="text"
            placeholder="검색..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              padding: '4px 8px 4px 24px',
              border: `1px solid ${C.border}`,
              borderRadius: S.radius,
              fontSize: S.label,
              boxSizing: 'border-box',
              background: C.bgInput,
              color: C.text,
              outline: 'none',
            }}
          />
        </div>
        <button
          onClick={() => setShowWatchlistOnly(!showWatchlistOnly)}
          style={{
            background: showWatchlistOnly ? C.gold : 'transparent',
            color: showWatchlistOnly ? C.bgDeep : C.textDim,
            border: `1px solid ${showWatchlistOnly ? C.gold : C.borderLight}`,
            borderRadius: S.radius,
            width: 22, height: 22,
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
            transition: 'all 0.15s',
          }}
          title="관심 종목만 보기"
        >
          <Icon icon={showWatchlistOnly ? 'tabler:star-filled' : 'tabler:star'} width={11} />
        </button>
      </div>

      {/* Asset List */}
      <div style={{ flex: 1, overflow: 'auto', padding: '2px 4px' }}>
        {isLoading ? (
          <div style={{ padding: 12, color: C.textMuted, fontSize: S.label, textAlign: 'center' }}>
            <Icon icon="tabler:loader-2" width={16} style={{ animation: 'spin 1s linear infinite' }} />
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 12, color: C.textDim, fontSize: S.label, textAlign: 'center' }}>
            {showWatchlistOnly ? '관심 종목 없음' : '검색 결과 없음'}
          </div>
        ) : (
          filtered.map((quote) => {
            const isUp = quote.changePercent >= 0;
            const isSelected = selectedSymbol === quote.symbol;
            const isWatched = watchlist.has(quote.symbol);

            return (
              <div
                key={quote.symbol}
                style={{
                  padding: '5px 8px',
                  marginBottom: 1,
                  background: isSelected
                    ? `linear-gradient(90deg, rgba(59,130,246,0.10), rgba(59,130,246,0.03))`
                    : 'transparent',
                  borderLeft: isSelected ? `2px solid ${C.gold}` : '2px solid transparent',
                  borderRadius: '0 3px 3px 0',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  justifyContent: 'space-between',
                  transition: 'all 0.12s',
                }}
                onClick={() => onSelect(quote.symbol)}
                onMouseEnter={(e) => {
                  if (!isSelected) e.currentTarget.style.background = C.bgHover;
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) e.currentTarget.style.background = 'transparent';
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: S.value,
                    fontWeight: 600,
                    color: isSelected ? C.gold : C.text,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {quote.symbol}
                  </div>
                  <div style={{
                    display: 'flex',
                    gap: 6,
                    fontSize: S.label,
                    marginTop: 1,
                    fontVariantNumeric: 'tabular-nums',
                  }}>
                    <span style={{ color: C.textMuted }}>{quote.price.toFixed(0)}</span>
                    <span style={{ color: isUp ? C.up : C.down, fontWeight: 600 }}>
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
                    background: 'transparent',
                    color: isWatched ? C.goldBright : C.textDim,
                    border: 'none',
                    width: 18,
                    height: 18,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    padding: 0,
                    transition: 'color 0.15s',
                  }}
                  title="관심 종목"
                >
                  <Icon icon={isWatched ? 'tabler:star-filled' : 'tabler:star'} width={13} />
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
// Left Panel (Tabbed: 종목 / 호가)
// ═══════════════════════════════════════════════
const LeftPanel = memo(({
  selectedSymbol,
  onSelect,
  watchlist,
  onWatchlistToggle,
}: {
  selectedSymbol: string | null;
  onSelect: (symbol: string) => void;
  watchlist: Set<string>;
  onWatchlistToggle: (symbol: string) => void;
}) => {
  const [activeTab, setActiveTab] = useState<'assets' | 'orderbook'>('assets');

  const tabStyle = (active: boolean) => ({
    flex: 1,
    padding: '6px 0',
    background: 'transparent',
    color: active ? C.gold : C.textDim,
    border: 'none',
    borderBottom: `2px solid ${active ? C.gold : 'transparent'}`,
    fontSize: S.label,
    fontWeight: 700 as const,
    cursor: 'pointer' as const,
    display: 'flex' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 4,
    transition: 'all 0.15s',
  });

  return (
    <div style={{
      width: 190,
      minWidth: 190,
      maxWidth: 190,
      borderRight: `1px solid ${C.border}`,
      display: 'flex',
      flexDirection: 'column',
      background: C.bgDeep,
    }}>
      {/* Tabs */}
      <div style={{
        display: 'flex',
        background: C.bgSurface,
        borderBottom: `1px solid ${C.border}`,
      }}>
        <button onClick={() => setActiveTab('assets')} style={tabStyle(activeTab === 'assets')}>
          <Icon icon="tabler:list" width={12} />
          종목
        </button>
        <button onClick={() => setActiveTab('orderbook')} style={tabStyle(activeTab === 'orderbook')}>
          <Icon icon="tabler:book" width={12} />
          호가
        </button>
      </div>

      {/* Tab Content */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        {activeTab === 'assets' ? (
          <AssetList
            onSelect={onSelect}
            selectedSymbol={selectedSymbol}
            watchlist={watchlist}
            onWatchlistToggle={onWatchlistToggle}
          />
        ) : (
          <OrderBook symbol={selectedSymbol} expanded />
        )}
      </div>
    </div>
  );
});
LeftPanel.displayName = 'LeftPanel';

// ═══════════════════════════════════════════════
// Chart Panel (Center)
// ═══════════════════════════════════════════════
const ChartPanel = memo(({ symbol }: { symbol: string | null }) => {
  const [timeframe, setTimeframe] = useState<'1m' | '5m' | '1h' | '1d'>('1m');

  const tfLabels: Record<string, string> = {
    '1m': '1분',
    '5m': '5분',
    '1h': '1시간',
    '1d': '1일',
  };

  return (
    <div style={{
      flex: 1,
      minWidth: 0,
      display: 'flex',
      flexDirection: 'column',
      background: C.chartBg,
    }}>
      {/* Timeframe Tabs */}
      <div style={{
        display: 'flex',
        gap: 2,
        padding: '5px 8px',
        borderBottom: `1px solid ${C.border}`,
        background: C.bgSurface,
        alignItems: 'center',
      }}>
        <Icon icon="tabler:chart-candle" width={13} style={{ color: C.gold, marginRight: 4 }} />
        {(['1m', '5m', '1h', '1d'] as const).map((tf) => (
          <button
            key={tf}
            onClick={() => setTimeframe(tf)}
            style={{
              padding: '3px 10px',
              background: timeframe === tf
                ? `linear-gradient(180deg, ${C.gold}, ${C.gold}dd)`
                : 'transparent',
              color: timeframe === tf ? C.bgDeep : C.textMuted,
              border: timeframe === tf
                ? 'none'
                : `1px solid ${C.border}`,
              borderRadius: S.radius,
              fontSize: S.label,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.12s',
            }}
          >
            {tfLabels[tf]}
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
// Price Chart (lightweight-charts)
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
  const liveCandleRef = useRef<{
    time: number; open: number; high: number; low: number; close: number;
  } | null>(null);

  const { data: historyData, isLoading } = usePriceHistory(symbol ?? '', timeframe, 100);

  // Create chart on mount
  useEffect(() => {
    if (!chartContainer.current) return;

    const c = createChart(chartContainer.current, {
      layout: {
        background: { type: ColorType.Solid, color: C.chartBg },
        textColor: C.textDim,
        fontFamily: C.font,
        fontSize: 10,
      },
      width: chartContainer.current.clientWidth,
      height: chartContainer.current.clientHeight,
      grid: {
        vertLines: { color: C.chartGrid },
        horzLines: { color: C.chartGrid },
      },
      timeScale: {
        timeVisible: true,
        secondsVisible: timeframe === '1m',
        borderColor: C.border,
      },
      rightPriceScale: {
        borderColor: C.border,
      },
      crosshair: {
        mode: 0,
        vertLine: { color: C.chartCrosshair, labelBackgroundColor: C.bgSurface },
        horzLine: { color: C.chartCrosshair, labelBackgroundColor: C.bgSurface },
      },
    });

    candleRef.current = c.addCandlestickSeries({
      upColor: C.up,
      downColor: C.down,
      wickUpColor: C.upSoft,
      wickDownColor: C.downSoft,
      borderUpColor: C.up,
      borderDownColor: C.down,
    });

    volumeRef.current = c.addHistogramSeries({
      color: C.gold,
      base: 0,
      priceFormat: { type: 'volume' },
      priceScaleId: 'volume',
    });
    c.priceScale('volume').applyOptions({
      scaleMargins: { top: 0.85, bottom: 0 },
    });

    lineRef.current = c.addLineSeries({
      color: C.goldBright,
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

  // Load candle data
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
      color: c.close >= c.open
        ? 'rgba(16, 185, 129, 0.30)'
        : 'rgba(239, 68, 68, 0.30)',
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

  return (
    <div style={{
      flex: 1,
      minHeight: 100,
      overflow: 'hidden',
      position: 'relative',
      background: C.chartBg,
    }}>
      <div ref={chartContainer} style={{ position: 'absolute', inset: 0 }} />
      {!symbol && (
        <div style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          color: C.textDim,
          fontSize: S.value,
          gap: 8,
          background: C.chartBg,
          zIndex: 2,
        }}>
          <Icon icon="tabler:chart-candle" width={32} style={{ color: C.borderLight, opacity: 0.5 }} />
          <span>좌측에서 종목을 선택하세요</span>
        </div>
      )}
      {isLoading && symbol && (
        <div style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: C.textMuted,
          fontSize: S.value,
          pointerEvents: 'none',
          gap: 6,
          zIndex: 1,
        }}>
          <Icon icon="tabler:loader-2" width={16} style={{ animation: 'spin 1s linear infinite' }} />
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
      borderLeft: `1px solid ${C.border}`,
      display: 'flex',
      flexDirection: 'column',
      background: C.bgDeep,
    }}>
      <OrderForm symbol={symbol} onOrderPlaced={onOrderPlaced} />
    </div>
  );
});
RightPanel.displayName = 'RightPanel';

// ═══════════════════════════════════════════════
// Order Book (호가창)
// ═══════════════════════════════════════════════
const OrderBook = memo(({ symbol, expanded }: { symbol: string | null; expanded?: boolean }) => {
  const { data: quoteData } = useQuote(symbol ?? '');
  const quote = quoteData;

  const levels = expanded ? 7 : 3;
  const rowH = expanded ? 22 : 15;

  if (!symbol || !quote) {
    return (
      <div style={{
        flex: expanded ? 1 : undefined,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        color: C.textDim,
        fontSize: S.label,
        gap: 6,
        padding: 16,
      }}>
        <Icon icon="tabler:book" width={20} style={{ opacity: 0.4 }} />
        <span>종목을 선택하세요</span>
      </div>
    );
  }

  const spreadPercent = 0.01;
  const spread = quote.price * spreadPercent;
  const maxQty = 1500;

  const asks = Array.from({ length: levels }, (_, i) => ({
    price: quote.price + (levels - i) * spread / levels,
    qty: 800 + Math.random() * 700,
  }));
  const bids = Array.from({ length: levels }, (_, i) => ({
    price: quote.price - (i + 1) * spread / levels,
    qty: 800 + Math.random() * 700,
  }));

  const renderRow = (item: { price: number; qty: number }, side: 'ask' | 'bid', i: number) => {
    const fillW = (item.qty / maxQty) * 100;
    const isAsk = side === 'ask';
    return (
      <div key={`${side}-${i}`} style={{
        display: 'flex',
        justifyContent: 'space-between',
        padding: `0 ${expanded ? '8px' : '4px'}`,
        fontSize: expanded ? S.value : S.label,
        fontVariantNumeric: 'tabular-nums',
        position: 'relative',
        height: rowH,
        alignItems: 'center',
      }}>
        <div style={{
          position: 'absolute',
          right: 0, top: 0, bottom: 0,
          width: `${fillW}%`,
          background: isAsk ? C.downBg : C.upBg,
          borderRadius: 1,
        }} />
        <span style={{ color: isAsk ? C.down : C.up, fontWeight: 500, position: 'relative' }}>
          {item.price.toFixed(0)}
        </span>
        <span style={{ color: C.textDim, position: 'relative' }}>
          {Math.floor(item.qty)}
        </span>
      </div>
    );
  };

  return (
    <div style={{
      flex: expanded ? 1 : undefined,
      borderBottom: expanded ? 'none' : `1px solid ${C.border}`,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      ...(expanded ? {} : { flexShrink: 0, maxHeight: 160 }),
    }}>
      {/* Column Header */}
      <div style={{
        padding: `4px ${expanded ? '14px' : '10px'}`,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottom: `1px solid ${C.border}`,
        flexShrink: 0,
      }}>
        <span style={{ fontSize: 9, color: C.textDim }}>가격</span>
        <span style={{ fontSize: 9, color: C.textDim }}>수량</span>
      </div>

      {/* Asks (sell) — red */}
      <div style={{ padding: `1px ${expanded ? '6px' : '6px'}`, flex: expanded ? 1 : undefined, display: 'flex', flexDirection: 'column', justifyContent: expanded ? 'flex-end' : undefined }}>
        {asks.map((ask, i) => renderRow(ask, 'ask', i))}
      </div>

      {/* Current price */}
      <div style={{
        padding: `${expanded ? '6px' : '3px'} 10px`,
        background: C.bgHover,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        borderTop: `1px solid ${C.border}`,
        borderBottom: `1px solid ${C.border}`,
        flexShrink: 0,
      }}>
        <span style={{
          fontSize: expanded ? 16 : S.price,
          fontWeight: 700,
          color: quote.changePercent >= 0 ? C.up : C.down,
          fontVariantNumeric: 'tabular-nums',
        }}>
          {quote.price.toFixed(0)}
        </span>
        <Icon
          icon={quote.changePercent >= 0 ? 'tabler:arrow-up' : 'tabler:arrow-down'}
          width={expanded ? 13 : 11}
          style={{ color: quote.changePercent >= 0 ? C.up : C.down }}
        />
        <span style={{ fontSize: 9, color: C.textDim, marginLeft: 2 }}>
          {quote.changePercent >= 0 ? '+' : ''}{quote.changePercent.toFixed(2)}%
        </span>
      </div>

      {/* Bids (buy) — green */}
      <div style={{ padding: `1px ${expanded ? '6px' : '6px'}`, flex: expanded ? 1 : undefined }}>
        {bids.map((bid, i) => renderRow(bid, 'bid', i))}
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
  const { data: portfolioData } = usePortfolio(user?.id ?? '');
  const { mutate: placeOrder, isPending, isError, error } = usePlaceOrder();

  const [isBuy, setIsBuy] = useState(true);
  const [orderType, setOrderType] = useState<'시장가' | '지정가' | '손절' | '익절'>('시장가');
  const [quantity, setQuantity] = useState('');
  const [limitPrice, setLimitPrice] = useState('');

  const quote = quoteData;
  const quantityNum = parseInt(quantity, 10) || 0;
  const limitPriceNum = parseFloat(limitPrice) || quote?.price || 0;
  const totalCost = quantityNum * (orderType === '시장가' ? quote?.price ?? 0 : limitPriceNum);
  const availableGold = portfolioData?.gold ?? user?.gold ?? 0;
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

  const inputStyle = {
    width: '100%',
    padding: '5px 8px',
    border: `1px solid ${C.border}`,
    borderRadius: S.radius,
    fontSize: S.value,
    boxSizing: 'border-box' as const,
    background: C.bgInput,
    color: C.text,
    outline: 'none',
    fontVariantNumeric: 'tabular-nums' as const,
  };

  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'auto',
    }}>
      {/* Buy/Sell Toggle */}
      <div style={{
        display: 'flex',
        padding: '6px',
        gap: 4,
        background: C.bgSurface,
        borderBottom: `1px solid ${C.border}`,
      }}>
        <button
          onClick={() => setIsBuy(true)}
          style={{
            flex: 1,
            padding: '5px 0',
            background: isBuy
              ? `linear-gradient(180deg, ${C.up}, ${C.upSoft})`
              : 'transparent',
            color: isBuy ? '#fff' : C.textDim,
            border: isBuy ? 'none' : `1px solid ${C.border}`,
            borderRadius: S.radius,
            fontSize: S.value,
            fontWeight: 700,
            cursor: 'pointer',
            transition: 'all 0.12s',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 4,
          }}
        >
          <Icon icon="tabler:arrow-up-right" width={13} />
          매수
        </button>
        <button
          onClick={() => setIsBuy(false)}
          style={{
            flex: 1,
            padding: '5px 0',
            background: !isBuy
              ? `linear-gradient(180deg, ${C.down}, ${C.downSoft})`
              : 'transparent',
            color: !isBuy ? '#fff' : C.textDim,
            border: !isBuy ? 'none' : `1px solid ${C.border}`,
            borderRadius: S.radius,
            fontSize: S.value,
            fontWeight: 700,
            cursor: 'pointer',
            transition: 'all 0.12s',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 4,
          }}
        >
          <Icon icon="tabler:arrow-down-right" width={13} />
          매도
        </button>
      </div>

      {!symbol ? (
        <div style={{
          padding: 16,
          color: C.textDim,
          fontSize: S.label,
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 6,
        }}>
          <Icon icon="tabler:click" width={20} />
          종목을 선택하세요
        </div>
      ) : (
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          padding: '6px 8px',
          overflow: 'auto',
          gap: 6,
        }}>
          {/* Current Price */}
          <div style={{
            padding: '6px 8px',
            background: C.bgSurface,
            borderRadius: S.radius,
            border: `1px solid ${C.border}`,
          }}>
            <div style={{ fontSize: 9, color: C.textDim, marginBottom: 2 }}>현재가</div>
            <div style={{
              fontSize: 15,
              fontWeight: 700,
              color: C.text,
              fontVariantNumeric: 'tabular-nums',
            }}>
              {quote?.price.toLocaleString(undefined, { maximumFractionDigits: 0 }) ?? '—'}
              <span style={{ fontSize: 10, color: C.textDim, marginLeft: 4 }}>골드</span>
            </div>
          </div>

          {/* Order Type */}
          <div>
            <div style={{ fontSize: 9, color: C.textDim, marginBottom: 3 }}>주문 유형</div>
            <select
              value={orderType}
              onChange={(e) => setOrderType(e.target.value as any)}
              style={{
                ...inputStyle,
                cursor: 'pointer',
                appearance: 'none',
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right 8px center',
                paddingRight: 24,
              }}
            >
              <option value="시장가">시장가</option>
              <option value="지정가">지정가</option>
              <option value="손절">손절</option>
              <option value="익절">익절</option>
            </select>
          </div>

          {/* Limit Price */}
          {orderType !== '시장가' && (
            <div>
              <div style={{ fontSize: 9, color: C.textDim, marginBottom: 3 }}>
                {orderType === '지정가' ? '지정가' : '트리거가'}
              </div>
              <input
                type="number"
                value={limitPrice}
                onChange={(e) => setLimitPrice(e.target.value)}
                placeholder="0"
                style={inputStyle}
              />
            </div>
          )}

          {/* Quantity */}
          <div>
            <div style={{ fontSize: 9, color: C.textDim, marginBottom: 3 }}>수량</div>
            <input
              type="number"
              min="0"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="0"
              style={inputStyle}
            />
          </div>

          {/* Summary */}
          <div style={{
            padding: '6px 8px',
            background: C.bgSurface,
            borderRadius: S.radius,
            border: `1px solid ${C.border}`,
            fontSize: S.label,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
              <span style={{ color: C.textDim }}>주문총액</span>
              <span style={{
                fontWeight: 700,
                color: totalCost > availableGold && isBuy ? C.down : C.text,
                fontVariantNumeric: 'tabular-nums',
              }}>
                {totalCost.toLocaleString()} G
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: C.textDim }}>보유 골드</span>
              <span style={{ fontWeight: 600, color: C.gold, fontVariantNumeric: 'tabular-nums' }}>
                {availableGold.toLocaleString()} G
              </span>
            </div>
          </div>

          {/* Submit */}
          <button
            onClick={handleOrder}
            disabled={!canOrder || isPending}
            style={{
              padding: '7px 0',
              background: isPending || !canOrder
                ? C.bgHover
                : isBuy
                  ? `linear-gradient(180deg, ${C.up}, ${C.upSoft})`
                  : `linear-gradient(180deg, ${C.down}, ${C.downSoft})`,
              color: isPending || !canOrder ? C.textDim : '#fff',
              border: 'none',
              borderRadius: S.radius,
              fontSize: S.value,
              fontWeight: 700,
              cursor: isPending || !canOrder ? 'not-allowed' : 'pointer',
              transition: 'all 0.15s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4,
            }}
          >
            {isPending ? (
              <>
                <Icon icon="tabler:loader-2" width={13} style={{ animation: 'spin 1s linear infinite' }} />
                처리중...
              </>
            ) : (
              <>
                <Icon icon={isBuy ? 'tabler:shopping-cart' : 'tabler:cash'} width={13} />
                {isBuy ? '매수 주문' : '매도 주문'}
              </>
            )}
          </button>

          {isError && (
            <div style={{
              padding: '5px 8px',
              background: C.downBg,
              color: C.down,
              borderRadius: S.radius,
              fontSize: S.label,
              border: `1px solid rgba(239,68,68,0.2)`,
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}>
              <Icon icon="tabler:alert-circle" width={12} />
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

  const tabs = [
    { key: 'positions' as const, label: '보유종목', icon: 'tabler:briefcase' },
    { key: 'pending' as const, label: '미체결', icon: 'tabler:clock' },
    { key: 'history' as const, label: '거래이력', icon: 'tabler:history' },
    { key: 'allocation' as const, label: '자산배분', icon: 'tabler:chart-pie' },
  ];

  return (
    <div style={{
      height: 170,
      borderTop: `1px solid ${C.borderLight}`,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      background: C.bg,
    }}>
      {/* Tab Bar */}
      <div style={{
        display: 'flex',
        gap: 0,
        borderBottom: `1px solid ${C.border}`,
        background: C.bgSurface,
        flexShrink: 0,
      }}>
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              flex: 1,
              padding: '6px 0',
              background: 'transparent',
              color: activeTab === tab.key ? C.gold : C.textDim,
              border: 'none',
              borderBottom: activeTab === tab.key
                ? `2px solid ${C.gold}`
                : '2px solid transparent',
              fontSize: S.label,
              fontWeight: activeTab === tab.key ? 700 : 500,
              cursor: 'pointer',
              transition: 'all 0.12s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4,
            }}
          >
            <Icon icon={tab.icon} width={12} />
            {tab.label}
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
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        padding: '5px 10px',
        borderBottom: `1px solid ${C.border}`,
        fontSize: 9,
        fontWeight: 700,
        color: C.textDim,
        background: C.bgSurface,
        gap: 4,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
      }}>
        <div style={{ flex: 1.2 }}>종목</div>
        <div style={{ flex: 0.8, textAlign: 'right' }}>수량</div>
        <div style={{ flex: 1, textAlign: 'right' }}>평균단가</div>
        <div style={{ flex: 1, textAlign: 'right' }}>현재가</div>
        <div style={{ flex: 0.8, textAlign: 'right' }}>수익률</div>
      </div>

      {/* Rows */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {positions.length === 0 ? (
          <div style={{
            padding: 16,
            color: C.textDim,
            fontSize: S.label,
            textAlign: 'center',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
          }}>
            <Icon icon="tabler:inbox" width={14} />
            보유 종목 없음
          </div>
        ) : (
          positions.map((pos, idx) => {
            const isProfit = pos.pnlPercent >= 0;
            return (
              <div
                key={pos.symbol}
                style={{
                  display: 'flex',
                  padding: '4px 10px',
                  borderBottom: `1px solid ${C.border}`,
                  fontSize: S.label,
                  alignItems: 'center',
                  gap: 4,
                  background: idx % 2 === 0 ? 'transparent' : C.bgSurface,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                <div style={{ flex: 1.2, fontWeight: 600, color: C.gold }}>{pos.symbol}</div>
                <div style={{ flex: 0.8, textAlign: 'right', color: C.textMuted }}>{pos.quantity}</div>
                <div style={{ flex: 1, textAlign: 'right', color: C.textMuted }}>{pos.averagePrice.toFixed(0)}</div>
                <div style={{ flex: 1, textAlign: 'right', color: C.text }}>{pos.currentPrice.toFixed(0)}</div>
                <div style={{
                  flex: 0.8,
                  textAlign: 'right',
                  color: isProfit ? C.up : C.down,
                  fontWeight: 700,
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

  const typeLabel: Record<string, string> = {
    limit: '지정가', stop_loss: '손절', take_profit: '익절', market: '시장가',
  };
  const sideLabel = (s: string) => s === 'buy' ? '매수' : '매도';

  if (pendingOrders.length === 0) {
    return (
      <div style={{
        padding: 16,
        color: C.textDim,
        fontSize: S.label,
        textAlign: 'center',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
      }}>
        <Icon icon="tabler:clock-off" width={14} />
        미체결 주문 없음
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1.2fr 0.8fr 0.8fr 0.8fr 1fr 0.6fr',
        padding: '5px 10px',
        borderBottom: `1px solid ${C.border}`,
        fontSize: 9,
        fontWeight: 700,
        background: C.bgSurface,
        color: C.textDim,
        gap: 4,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
      }}>
        <div>종목</div>
        <div>매매</div>
        <div>유형</div>
        <div style={{ textAlign: 'right' }}>수량</div>
        <div style={{ textAlign: 'right' }}>주문가</div>
        <div></div>
      </div>

      {/* Rows */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {pendingOrders.map((order, idx) => (
          <div
            key={order.id}
            style={{
              display: 'grid',
              gridTemplateColumns: '1.2fr 0.8fr 0.8fr 0.8fr 1fr 0.6fr',
              padding: '4px 10px',
              borderBottom: `1px solid ${C.border}`,
              background: idx % 2 === 0 ? 'transparent' : C.bgSurface,
              alignItems: 'center',
              fontSize: S.label,
              gap: 4,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            <div style={{ fontWeight: 600, color: C.gold }}>{order.symbol}</div>
            <div style={{ color: order.side === 'buy' ? C.up : C.down, fontWeight: 600 }}>
              {sideLabel(order.side)}
            </div>
            <div style={{ color: C.textMuted }}>{typeLabel[order.type] || order.type}</div>
            <div style={{ textAlign: 'right', color: C.textMuted }}>{order.quantity.toFixed(0)}</div>
            <div style={{ textAlign: 'right', color: C.text, fontWeight: 500 }}>
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
                padding: '2px 0',
                border: 'none',
                background: 'transparent',
                color: C.down,
                fontSize: 9,
                cursor: isCancelling ? 'default' : 'pointer',
                fontWeight: 700,
                opacity: isCancelling ? 0.4 : 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 2,
              }}
            >
              <Icon icon="tabler:x" width={10} />
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
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        padding: '5px 10px',
        borderBottom: `1px solid ${C.border}`,
        fontSize: 9,
        fontWeight: 700,
        color: C.textDim,
        background: C.bgSurface,
        gap: 4,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
      }}>
        <div style={{ flex: 1.2 }}>종목</div>
        <div style={{ flex: 0.7, textAlign: 'right' }}>수량</div>
        <div style={{ flex: 1, textAlign: 'right' }}>체결가</div>
        <div style={{ flex: 0.6, textAlign: 'center' }}>매매</div>
      </div>

      {/* Rows */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {trades.length === 0 ? (
          <div style={{
            padding: 16,
            color: C.textDim,
            fontSize: S.label,
            textAlign: 'center',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
          }}>
            <Icon icon="tabler:receipt-off" width={14} />
            거래 이력 없음
          </div>
        ) : (
          trades.map((trade, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                padding: '4px 10px',
                borderBottom: `1px solid ${C.border}`,
                fontSize: S.label,
                alignItems: 'center',
                gap: 4,
                background: i % 2 === 0 ? 'transparent' : C.bgSurface,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              <div style={{ flex: 1.2, fontWeight: 600, color: C.gold }}>{trade.symbol}</div>
              <div style={{ flex: 0.7, textAlign: 'right', color: C.textMuted }}>{trade.quantity}</div>
              <div style={{ flex: 1, textAlign: 'right', color: C.text }}>{trade.price.toFixed(0)}</div>
              <div style={{
                flex: 0.6,
                textAlign: 'center',
                color: trade.side === 'buy' ? C.up : C.down,
                fontWeight: 700,
                fontSize: 9,
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
  const { data: portfolioData } = usePortfolio(userId);
  const positions = portfolioData?.positions ?? [];
  const gold = portfolioData?.gold ?? 0;

  const totalPositionValue = positions.reduce((sum, pos) => sum + pos.currentPrice * pos.quantity, 0);
  const totalValue = gold + totalPositionValue;
  const cashPercent = totalValue > 0 ? (gold / totalValue) * 100 : 0;
  const positionPercent = 100 - cashPercent;

  return (
    <div style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Total Asset */}
      <div style={{
        padding: '6px 10px',
        background: C.bgSurface,
        borderRadius: S.radius,
        border: `1px solid ${C.borderGold}`,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <span style={{ fontSize: S.label, color: C.textMuted, display: 'flex', alignItems: 'center', gap: 4 }}>
          <Icon icon="tabler:wallet" width={13} style={{ color: C.gold }} />
          총 자산
        </span>
        <span style={{ fontSize: 14, fontWeight: 700, color: C.gold, fontVariantNumeric: 'tabular-nums' }}>
          {totalValue.toLocaleString()} G
        </span>
      </div>

      {/* Cash Bar */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3, fontSize: S.label }}>
          <span style={{ color: C.textMuted, display: 'flex', alignItems: 'center', gap: 4 }}>
            <Icon icon="tabler:coins" width={11} style={{ color: C.goldBright }} />
            보유 골드
          </span>
          <span style={{ fontWeight: 600, color: C.text, fontVariantNumeric: 'tabular-nums' }}>
            {gold.toLocaleString()}
          </span>
        </div>
        <div style={{
          width: '100%',
          height: 6,
          background: C.bgInput,
          borderRadius: 3,
          overflow: 'hidden',
        }}>
          <div style={{
            width: `${cashPercent}%`,
            height: '100%',
            background: `linear-gradient(90deg, ${C.gold}, ${C.goldBright})`,
            borderRadius: 3,
            transition: 'width 0.3s ease',
          }} />
        </div>
        <div style={{ fontSize: 9, color: C.textDim, marginTop: 2 }}>
          {cashPercent.toFixed(1)}%
        </div>
      </div>

      {/* Position Bar */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3, fontSize: S.label }}>
          <span style={{ color: C.textMuted, display: 'flex', alignItems: 'center', gap: 4 }}>
            <Icon icon="tabler:chart-treemap" width={11} style={{ color: C.up }} />
            투자 종목
          </span>
          <span style={{ fontWeight: 600, color: C.text, fontVariantNumeric: 'tabular-nums' }}>
            {totalPositionValue.toLocaleString()}
          </span>
        </div>
        <div style={{
          width: '100%',
          height: 6,
          background: C.bgInput,
          borderRadius: 3,
          overflow: 'hidden',
        }}>
          <div style={{
            width: `${positionPercent}%`,
            height: '100%',
            background: `linear-gradient(90deg, ${C.upSoft}, ${C.up})`,
            borderRadius: 3,
            transition: 'width 0.3s ease',
          }} />
        </div>
        <div style={{ fontSize: 9, color: C.textDim, marginTop: 2 }}>
          {positionPercent.toFixed(1)}%
        </div>
      </div>

      {/* Position Breakdown */}
      {positions.length > 0 && (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 2 }}>
          {positions.map((pos) => {
            const val = pos.currentPrice * pos.quantity;
            const pct = totalValue > 0 ? (val / totalValue) * 100 : 0;
            const isProfit = pos.pnlPercent >= 0;
            return (
              <div key={pos.symbol} style={{
                padding: '3px 6px',
                background: C.bgSurface,
                borderRadius: S.radius,
                border: `1px solid ${C.border}`,
                fontSize: 9,
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}>
                <span style={{ color: C.gold, fontWeight: 600 }}>{pos.symbol}</span>
                <span style={{ color: C.textDim }}>{pct.toFixed(1)}%</span>
                <span style={{ color: isProfit ? C.up : C.down, fontWeight: 600 }}>
                  {isProfit ? '+' : ''}{pos.pnlPercent.toFixed(1)}%
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
});
AllocationTab.displayName = 'AllocationTab';
