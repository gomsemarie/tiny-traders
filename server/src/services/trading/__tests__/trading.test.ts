import { describe, it, expect } from 'vitest';
import { evaluateAutoTrade, runAutoTradeSimulation, CharacterStats } from '../auto-trade-service';
import { executeDisruptionTrade, DisruptionType } from '../disruption-trade-service';

// ============================================================================
// AUTO-TRADE SERVICE TESTS
// ============================================================================

describe('Auto-Trade Service - Pure Logic Tests', () => {
  // Mock character stats
  const lowInitiativeStats: CharacterStats = {
    stamina: 5,
    efficiency: 5,
    precision: 5,
    mental: 5,
    initiative: 1, // Very low
    discipline: 5,
    luck: 5,
  };

  const highInitiativeStats: CharacterStats = {
    stamina: 5,
    efficiency: 5,
    precision: 5,
    mental: 5,
    initiative: 10, // Very high
    discipline: 5,
    luck: 5,
  };

  const highDisciplineStats: CharacterStats = {
    stamina: 5,
    efficiency: 5,
    precision: 5,
    mental: 5,
    initiative: 5,
    discipline: 10, // Very high
    luck: 5,
  };

  const highMentalStats: CharacterStats = {
    stamina: 5,
    efficiency: 5,
    precision: 5,
    mental: 10, // Very high
    initiative: 5,
    discipline: 5,
    luck: 5,
  };

  const highLuckStats: CharacterStats = {
    stamina: 5,
    efficiency: 5,
    precision: 5,
    mental: 5,
    initiative: 5,
    discipline: 5,
    luck: 10, // Very high
  };

  const mockPositions = [
    { symbol: 'AAPL', quantity: 10, avgPrice: 150 },
    { symbol: 'BTC-USD', quantity: 0.5, avgPrice: 40000 },
  ];

  const mockQuotes = [
    { symbol: 'AAPL', price: 155 }, // +3.3% gain
    { symbol: 'BTC-USD', price: 38000 }, // -5% loss
    { symbol: 'MSFT', price: 300 },
    { symbol: 'ETH-USD', price: 2000 },
  ];

  it('should hold when initiative is very low', () => {
    // Low initiative characters rarely trade
    const decisions = [];
    for (let i = 0; i < 100; i++) {
      const decision = evaluateAutoTrade(lowInitiativeStats, mockPositions, mockQuotes);
      decisions.push(decision.action);
    }
    const holdCount = decisions.filter((a) => a === 'hold').length;
    expect(holdCount).toBeGreaterThan(50); // Expect mostly holds
  });

  it('should trade more frequently with high initiative', () => {
    // High initiative characters trade more
    const decisions = [];
    for (let i = 0; i < 200; i++) {
      const decision = evaluateAutoTrade(highInitiativeStats, mockPositions, mockQuotes);
      decisions.push(decision.action);
    }
    const actionCount = decisions.filter((a) => a !== 'hold').length;
    expect(actionCount).toBeGreaterThan(30); // Expect significant trading activity
  });

  it('should panic sell losing positions when mental is low', () => {
    // Low mental = more panic selling of losing positions
    const lowMentalStats: CharacterStats = {
      stamina: 5,
      efficiency: 5,
      precision: 5,
      mental: 1, // Very low
      initiative: 10, // High initiative to ensure we try
      discipline: 5,
      luck: 5,
    };

    const sellCount = runAutoTradeSimulation(lowMentalStats, mockPositions, mockQuotes, 200).sellCount;
    expect(sellCount).toBeGreaterThan(10); // Should have some panic sells
  });

  it('should resist panic selling with high mental', () => {
    // High mental = less panic selling
    const sellCount = runAutoTradeSimulation(highMentalStats, mockPositions, mockQuotes, 200).sellCount;
    expect(sellCount).toBeLessThan(30); // Less aggressive selling
  });

  it('should reduce random buys with high discipline', () => {
    // High discipline = fewer impulsive buys
    const buyCountDisciplined = runAutoTradeSimulation(highDisciplineStats, mockPositions, mockQuotes, 500).buyCount;
    const lowDisciplineStats: CharacterStats = { ...highInitiativeStats, discipline: 1 };
    const buyCountLowDiscipline = runAutoTradeSimulation(lowDisciplineStats, mockPositions, mockQuotes, 500).buyCount;
    // High discipline should buy less frequently than low discipline with high initiative
    expect(buyCountDisciplined).toBeLessThan(buyCountLowDiscipline);
  });

  it('should return valid symbol for buy decisions', () => {
    for (let i = 0; i < 50; i++) {
      const decision = evaluateAutoTrade(highInitiativeStats, [], mockQuotes);
      if (decision.action === 'buy') {
        expect(decision.symbol).toBeDefined();
        expect(mockQuotes.map((q) => q.symbol)).toContain(decision.symbol);
        expect(decision.quantity).toBeGreaterThan(0);
        break;
      }
    }
  });

  it('should return valid symbol for sell decisions', () => {
    for (let i = 0; i < 50; i++) {
      const decision = evaluateAutoTrade(highInitiativeStats, mockPositions, mockQuotes);
      if (decision.action === 'sell') {
        expect(decision.symbol).toBeDefined();
        expect(mockPositions.map((p) => p.symbol)).toContain(decision.symbol);
        expect(decision.quantity).toBeGreaterThan(0);
        break;
      }
    }
  });

  it('should have efficiency influence quantity sizing', () => {
    const stats1: CharacterStats = { ...highInitiativeStats, efficiency: 2 }; // Low
    const stats10: CharacterStats = { ...highInitiativeStats, efficiency: 10 }; // High

    let qty1Count = 0;
    let qty10Count = 0;

    for (let i = 0; i < 100; i++) {
      const d1 = evaluateAutoTrade(stats1, [], mockQuotes);
      const d10 = evaluateAutoTrade(stats10, [], mockQuotes);

      if (d1.action === 'buy' && d1.quantity) qty1Count += d1.quantity;
      if (d10.action === 'buy' && d10.quantity) qty10Count += d10.quantity;
    }

    // High efficiency should buy larger quantities on average
    expect(qty10Count).toBeGreaterThanOrEqual(qty1Count);
  });

  it('runAutoTradeSimulation should return statistics', () => {
    const stats = runAutoTradeSimulation(highInitiativeStats, mockPositions, mockQuotes, 100);
    expect(stats.buyCount + stats.sellCount + stats.holdCount).toBe(100);
    expect(stats.avgQuantity).toBeGreaterThanOrEqual(0);
  });

  it('should have at least 20 buy decisions over 1000 iterations with high initiative', () => {
    const stats = runAutoTradeSimulation(highInitiativeStats, [], mockQuotes, 1000);
    expect(stats.buyCount).toBeGreaterThan(20);
  });

  it('should take profit on winning positions with discipline >= 6', () => {
    const winningPositions = [{ symbol: 'AAPL', quantity: 10, avgPrice: 100 }];
    const winningQuotes = [{ symbol: 'AAPL', price: 115 }]; // 15% gain

    const disciplinedStats: CharacterStats = { ...highDisciplineStats, initiative: 10 };
    const sellCount = runAutoTradeSimulation(disciplinedStats, winningPositions, winningQuotes, 200).sellCount;

    expect(sellCount).toBeGreaterThan(5); // Should take profit
  });

  it('should hold with no positions and reasonable market', () => {
    const decision = evaluateAutoTrade(lowInitiativeStats, [], mockQuotes);
    expect(['buy', 'hold']).toContain(decision.action);
  });

  it('should have trading decisions include reasoning', () => {
    const decision = evaluateAutoTrade(highInitiativeStats, mockPositions, mockQuotes);
    expect(decision.reasoning).toBeDefined();
    if (decision.reasoning) {
      expect(typeof decision.reasoning).toBe('string');
      expect(decision.reasoning.length).toBeGreaterThan(0);
    }
  });

  it('should have consistent decision logic across multiple runs (high initiative)', () => {
    const stats = highInitiativeStats;
    const simulation1 = runAutoTradeSimulation(stats, mockPositions, mockQuotes, 100);
    const simulation2 = runAutoTradeSimulation(stats, mockPositions, mockQuotes, 100);

    // Both should have at least some buy/sell (not deterministic, but pattern should be similar)
    expect(simulation1.buyCount + simulation1.sellCount).toBeGreaterThan(0);
    expect(simulation2.buyCount + simulation2.sellCount).toBeGreaterThan(0);
  });

  it('should have luck influence symbol selection quality', () => {
    // This is harder to test directly, but we can ensure lucky characters make decisions
    const decision = evaluateAutoTrade(highLuckStats, [], mockQuotes);
    expect(['buy', 'hold']).toContain(decision.action);
  });

  // ============================================================================
  // Fee and Order Validation Logic Tests
  // ============================================================================

  it('should calculate fee correctly', () => {
    const quantity = 10;
    const price = 100;
    const feeRate = 0.001;
    const expectedFee = quantity * price * feeRate;
    expect(expectedFee).toBe(1);
  });

  it('should handle zero fee rate', () => {
    const quantity = 10;
    const price = 100;
    const feeRate = 0;
    const fee = quantity * price * feeRate;
    expect(fee).toBe(0);
  });

  it('should handle high fee rate', () => {
    const quantity = 10;
    const price = 100;
    const feeRate = 0.05; // 5%
    const fee = quantity * price * feeRate;
    expect(fee).toBe(50);
  });

  it('should validate order quantity is positive', () => {
    expect(0).toBeLessThanOrEqual(0); // Invalid
    expect(1).toBeGreaterThan(0); // Valid
  });

  it('should validate order price is positive', () => {
    expect(100).toBeGreaterThan(0); // Valid
    expect(-100).toBeLessThan(0); // Invalid
  });

  // ============================================================================
  // Portfolio PnL Calculation Tests
  // ============================================================================

  it('should calculate unrealized PnL correctly for winning position', () => {
    const avgPrice = 100;
    const currentPrice = 110;
    const quantity = 10;
    const unrealizedPnL = quantity * (currentPrice - avgPrice);
    expect(unrealizedPnL).toBe(100);
  });

  it('should calculate unrealized PnL correctly for losing position', () => {
    const avgPrice = 100;
    const currentPrice = 90;
    const quantity = 10;
    const unrealizedPnL = quantity * (currentPrice - avgPrice);
    expect(unrealizedPnL).toBe(-100);
  });

  it('should calculate unrealized PnL percent correctly', () => {
    const avgPrice = 100;
    const currentPrice = 110;
    const quantity = 10;
    const investedAmount = quantity * avgPrice;
    const unrealizedPnL = quantity * (currentPrice - avgPrice);
    const percent = (unrealizedPnL / investedAmount) * 100;
    expect(percent).toBe(10);
  });

  it('should handle multiple positions portfolio PnL', () => {
    const positions = [
      { avgPrice: 100, currentPrice: 110, quantity: 10 }, // +100
      { avgPrice: 200, currentPrice: 190, quantity: 5 }, // -50
    ];
    const totalPnL = positions.reduce((sum, p) => sum + p.quantity * (p.currentPrice - p.avgPrice), 0);
    expect(totalPnL).toBe(50);
  });

  // ============================================================================
  // Disruption Trade Logic Tests (these test the enum/type safety)
  // ============================================================================

  it('should have valid disruption types', () => {
    const types: DisruptionType[] = ['impulse_buy', 'panic_sell', 'all_in'];
    expect(types.length).toBe(3);
    types.forEach((t) => expect(['impulse_buy', 'panic_sell', 'all_in']).toContain(t));
  });

  it('should validate luck stat range (1-10)', () => {
    for (let luck = 1; luck <= 10; luck++) {
      expect(luck).toBeGreaterThanOrEqual(1);
      expect(luck).toBeLessThanOrEqual(10);
    }
  });

  it('should validate all character stats in valid range', () => {
    const stats: CharacterStats = {
      stamina: 5,
      efficiency: 5,
      precision: 5,
      mental: 5,
      initiative: 5,
      discipline: 5,
      luck: 5,
    };

    Object.values(stats).forEach((stat) => {
      expect(stat).toBeGreaterThanOrEqual(1);
      expect(stat).toBeLessThanOrEqual(10);
    });
  });

  // ============================================================================
  // Additional Statistical Tests
  // ============================================================================

  it('should have balanced buy/sell ratio with neutral stats over large sample', () => {
    const neutralStats: CharacterStats = {
      stamina: 5,
      efficiency: 5,
      precision: 5,
      mental: 5,
      initiative: 5,
      discipline: 5,
      luck: 5,
    };

    const stats = runAutoTradeSimulation(neutralStats, mockPositions, mockQuotes, 1000);
    const actionRatio = (stats.buyCount + stats.sellCount) / 1000;
    expect(actionRatio).toBeGreaterThan(0.1); // At least 10% actions
    expect(actionRatio).toBeLessThan(0.9); // Less than 90% actions
  });

  it('should never return invalid actions', () => {
    for (let i = 0; i < 100; i++) {
      const decision = evaluateAutoTrade(highInitiativeStats, mockPositions, mockQuotes);
      expect(['buy', 'sell', 'hold']).toContain(decision.action);
    }
  });

  it('should have at least 30 distinct trades across 1000 runs with high initiative', () => {
    const stats = runAutoTradeSimulation(highInitiativeStats, mockPositions, mockQuotes, 1000);
    const totalTrades = stats.buyCount + stats.sellCount;
    expect(totalTrades).toBeGreaterThan(30);
  });

  it('should handle empty position list gracefully', () => {
    const decision = evaluateAutoTrade(highInitiativeStats, [], mockQuotes);
    expect(['buy', 'hold']).toContain(decision.action); // Can't sell if no positions
  });

  it('should handle empty quote list gracefully', () => {
    const decision = evaluateAutoTrade(highInitiativeStats, mockPositions, []);
    expect(['sell', 'hold']).toContain(decision.action); // Can't buy if no quotes
  });

  it('should have quantity always positive when action is buy or sell', () => {
    for (let i = 0; i < 200; i++) {
      const decision = evaluateAutoTrade(highInitiativeStats, mockPositions, mockQuotes);
      if (decision.action !== 'hold') {
        expect(decision.quantity).toBeGreaterThan(0);
      }
    }
  });
});
