/** TanStack Query key factory */
export const queryKeys = {
  // 시세 데이터
  quotes: {
    all: ['quotes'] as const,
    list: (symbols: string[]) => ['quotes', ...symbols] as const,
    detail: (symbol: string) => ['quotes', symbol] as const,
  },
  // 가격 히스토리 (OHLC)
  priceHistory: {
    all: ['priceHistory'] as const,
    detail: (symbol: string, interval: string, limit: number) => ['priceHistory', symbol, interval, limit] as const,
  },
  // 포트폴리오
  portfolio: {
    all: ['portfolio'] as const,
    mine: () => ['portfolio', 'mine'] as const,
    user: (userId: string) => ['portfolio', userId] as const,
  },
  // 거래 내역
  tradeHistory: {
    all: ['tradeHistory'] as const,
    user: (userId: string, limit: number = 20) => ['tradeHistory', userId, limit] as const,
  },
  // 미체결 주문
  pendingOrders: {
    all: ['pendingOrders'] as const,
    user: (userId: string) => ['pendingOrders', userId] as const,
  },
  // 랭킹
  ranking: {
    all: ['ranking'] as const,
    byType: (type: string) => ['ranking', type] as const,
  },
  // 캐릭터
  characters: {
    all: ['characters'] as const,
    mine: () => ['characters', 'mine'] as const,
    detail: (id: string) => ['characters', id] as const,
  },
  // 대출
  loans: {
    all: ['loans'] as const,
    requests: () => ['loans', 'requests'] as const,
  },
  // 마켓
  marketplace: {
    all: ['marketplace'] as const,
    characters: () => ['marketplace', 'characters'] as const,
    items: () => ['marketplace', 'items'] as const,
  },
  // 관리자
  admin: {
    all: ['admin'] as const,
    table: (tableName: string) => ['admin', tableName] as const,
  },
  // 적금
  banking: {
    all: ['banking'] as const,
    accounts: (userId: string) => ['banking', userId] as const,
  },
  // 이벤트
  events: {
    all: ['events'] as const,
    active: ['events', 'active'] as const,
    history: (limit: number) => ['events', 'history', limit] as const,
  },
} as const;
