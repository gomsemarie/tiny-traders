/**
 * Auto-trading service - pure logic, no DB
 * Character stats influence trading behavior
 */

export interface CharacterStats {
  stamina: number;
  efficiency: number;
  precision: number;
  mental: number;
  initiative: number;
  discipline: number;
  luck: number;
}

export interface Position {
  symbol: string;
  quantity: number;
  avgPrice: number;
}

export interface Quote {
  symbol: string;
  price: number;
}

export interface AutoTradeDecision {
  action: 'buy' | 'sell' | 'hold';
  symbol?: string;
  quantity?: number;
  reasoning?: string;
}

/**
 * Evaluate auto-trade decision based on character stats and current positions
 *
 * Logic:
 * - Initiative → trade frequency (chance to act at all)
 * - Discipline → reduces random/emotional trades
 * - Mental → resist panic selling losing positions
 * - Luck → better symbol selection
 */
export function evaluateAutoTrade(
  stats: CharacterStats,
  positions: Position[],
  quotes: Quote[],
): AutoTradeDecision {
  // Initiative (1-10): determines if we even consider trading
  // Low initiative = rarely acts, high = frequently acts
  const tradeChance = stats.initiative / 10; // 0.1 to 1.0
  if (Math.random() > tradeChance) {
    return { action: 'hold', reasoning: 'Low initiative - not trading this turn' };
  }

  // Discipline (1-10): reduces random trading impulses
  // High discipline = less random buys, more methodical
  const disciplineFactor = stats.discipline / 10; // 0.1 to 1.0

  // Check if we should sell (panic or profit taking)
  if (positions.length > 0) {
    const losingPositions = positions.filter((p) => {
      const quote = quotes.find((q) => q.symbol === p.symbol);
      return quote && quote.price < p.avgPrice;
    });

    if (losingPositions.length > 0) {
      // Mental (1-10): resist panic selling
      // High mental = less likely to panic sell
      const panicSellChance = (11 - stats.mental) / 15; // Inverted, 0.07 to 0.73

      // Discipline also reduces panic selling
      const adjustedPanicChance = panicSellChance * (1 - disciplineFactor * 0.5);

      if (Math.random() < adjustedPanicChance) {
        const position = losingPositions[0];
        return {
          action: 'sell',
          symbol: position.symbol,
          quantity: Math.max(1, Math.floor(position.quantity * 0.3)), // Sell 30% of position
          reasoning: 'Panic selling losing position due to low mental',
        };
      }
    }

    // Check for profit taking on winning positions
    const winningPositions = positions.filter((p) => {
      const quote = quotes.find((q) => q.symbol === p.symbol);
      return quote && quote.price > p.avgPrice * 1.1; // 10%+ profit
    });

    if (winningPositions.length > 0 && stats.discipline >= 6) {
      const position = winningPositions[0];
      const profitTakeChance = stats.discipline / 15; // 6-10 discipline = 0.4-0.67

      if (Math.random() < profitTakeChance) {
        return {
          action: 'sell',
          symbol: position.symbol,
          quantity: Math.max(1, Math.floor(position.quantity * 0.5)), // Sell 50% of position
          reasoning: 'Taking profit on winning position',
        };
      }
    }
  }

  // Consider buying
  if (quotes.length > 0) {
    // Luck influences symbol selection quality
    // High luck = pick best opportunity, low luck = random
    const useSmartSelection = stats.luck > 5;

    let selectedSymbol: string;
    if (useSmartSelection) {
      // Prefer symbols with good price changes
      const bestSymbol = quotes.reduce((best, current) => {
        const bestChange = best.price > 100 ? 0 : (Math.random() - 0.5) * 2; // Simulated momentum
        const currentChange = current.price > 100 ? 0 : (Math.random() - 0.5) * 2;
        return currentChange > bestChange ? current : best;
      });
      selectedSymbol = bestSymbol.symbol;
    } else {
      // Random selection
      selectedSymbol = quotes[Math.floor(Math.random() * quotes.length)].symbol;
    }

    // Discipline influences buy frequency
    const buyChance = disciplineFactor > 0.7 ? 0.1 : 0.3; // Disciplined = less impulsive buying

    if (Math.random() < buyChance) {
      // Efficiency influences quantity sizing
      const quantityFactor = Math.max(1, Math.floor(stats.efficiency / 2)); // 1-5 shares

      return {
        action: 'buy',
        symbol: selectedSymbol,
        quantity: quantityFactor,
        reasoning: `Selected ${selectedSymbol} - efficiency based sizing (${quantityFactor} shares)`,
      };
    }
  }

  return { action: 'hold', reasoning: 'No trading conditions met' };
}

/**
 * Run multiple auto-trade evaluations and get statistics
 * Useful for testing stat influence
 */
export function runAutoTradeSimulation(
  stats: CharacterStats,
  positions: Position[],
  quotes: Quote[],
  iterations: number = 100,
): {
  buyCount: number;
  sellCount: number;
  holdCount: number;
  avgQuantity: number;
} {
  let buyCount = 0;
  let sellCount = 0;
  let holdCount = 0;
  let totalQuantity = 0;
  let actionCount = 0;

  for (let i = 0; i < iterations; i++) {
    const decision = evaluateAutoTrade(stats, positions, quotes);
    if (decision.action === 'buy') {
      buyCount++;
      totalQuantity += decision.quantity ?? 0;
      actionCount++;
    } else if (decision.action === 'sell') {
      sellCount++;
      totalQuantity += decision.quantity ?? 0;
      actionCount++;
    } else {
      holdCount++;
    }
  }

  return {
    buyCount,
    sellCount,
    holdCount,
    avgQuantity: actionCount > 0 ? totalQuantity / actionCount : 0,
  };
}
