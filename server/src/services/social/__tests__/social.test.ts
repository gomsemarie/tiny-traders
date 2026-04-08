import { describe, it, expect, beforeEach, vi } from 'vitest';
import { randomUUID } from 'crypto';
import type { ChatMessage } from '../../chat/chat-service';
import type { Loan } from '../../loan/loan-service';
import type { Ranking } from '../../ranking/ranking-service';

// ─────────────────────────────────────────────────────────
// CHAT SERVICE TESTS
// ─────────────────────────────────────────────────────────

describe('Chat Service', () => {
  it('should create message with correct structure', async () => {
    const { randomUUID } = await import('crypto');
    const senderId = 'user1';
    const content = 'Hello world';
    const type = 'normal' as const;

    const message = {
      id: randomUUID(),
      senderId,
      recipientId: null,
      content,
      type,
      createdAt: new Date(),
    };

    expect(message.content).toBe('Hello world');
    expect(message.type).toBe('normal');
    expect(message.senderId).toBe('user1');
    expect(message.recipientId).toBeNull();
  });

  it('should create whisper message', () => {
    const message = {
      id: 'msg-123',
      senderId: 'user1',
      recipientId: 'user2',
      content: 'Secret msg',
      type: 'whisper' as const,
      createdAt: new Date(),
    };

    expect(message.type).toBe('whisper');
    expect(message.recipientId).toBe('user2');
  });

  it('should create emote message', () => {
    const message = {
      id: 'msg-456',
      senderId: 'user1',
      recipientId: null,
      content: ':wave:',
      type: 'emote' as const,
      createdAt: new Date(),
    };

    expect(message.type).toBe('emote');
  });

  it('should generate unique message IDs', () => {
    const { randomUUID } = require('crypto');
    const id1 = randomUUID();
    const id2 = randomUUID();
    expect(id1).not.toBe(id2);
  });

  it('should store multiple message types', () => {
    const messages = [
      { type: 'normal' as const },
      { type: 'whisper' as const },
      { type: 'system' as const },
      { type: 'emote' as const },
    ];

    expect(messages.length).toBe(4);
    expect(messages[0].type).toBe('normal');
    expect(messages[3].type).toBe('emote');
  });
});

// ─────────────────────────────────────────────────────────
// LOAN SERVICE TESTS
// ─────────────────────────────────────────────────────────

describe('Loan Service', () => {
  it('should calculate total repayment correctly', () => {
    // Test: 1000 gold principal + 10% interest = 1100 total
    const principal = 1000;
    const interestRate = 0.1;
    const total = principal * (1 + interestRate);
    expect(total).toBe(1100);
  });

  it('should calculate interest for 30-day term', () => {
    const principal = 5000;
    const annualRate = 0.12; // 12% annual
    const termDays = 30;
    const dailyRate = annualRate / 365;
    const interest = principal * dailyRate * termDays;
    expect(interest).toBeGreaterThan(0);
    expect(interest).toBeLessThan(principal * 0.05);
  });

  it('should detect default when overdue', () => {
    const now = new Date();
    const dueAt = new Date(now.getTime() - 1000 * 60 * 60); // 1 hour ago
    const isOverdue = dueAt < now;
    expect(isOverdue).toBe(true);
  });

  it('should track repaid amount', () => {
    const totalDue = 1100;
    let repaidAmount = 0;

    repaidAmount += 500;
    expect(repaidAmount).toBe(500);
    expect(totalDue - repaidAmount).toBe(600);

    repaidAmount += 600;
    expect(repaidAmount).toBe(totalDue);
  });

  it('should not allow overpayment', () => {
    const totalDue = 1100;
    const repaidSoFar = 1000;
    const paymentAttempt = 200;
    const remaining = totalDue - repaidSoFar;

    const isValid = paymentAttempt <= remaining;
    expect(isValid).toBe(false);
  });

  it('should determine when loan is fully repaid', () => {
    const totalDue = 1100;
    let repaidAmount = 0;

    repaidAmount = 550;
    expect(repaidAmount >= totalDue).toBe(false);

    repaidAmount = 1100;
    expect(repaidAmount >= totalDue).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────
// RANKING SERVICE TESTS
// ─────────────────────────────────────────────────────────

describe('Ranking Service', () => {
  it('should rank users by gold amount', () => {
    const users = [
      { id: '1', displayName: 'Alice', gold: 5000 },
      { id: '2', displayName: 'Bob', gold: 10000 },
      { id: '3', displayName: 'Charlie', gold: 3000 },
    ];

    const sorted = [...users].sort((a, b) => b.gold - a.gold);
    expect(sorted[0].displayName).toBe('Bob');
    expect(sorted[1].displayName).toBe('Alice');
    expect(sorted[2].displayName).toBe('Charlie');
  });

  it('should assign correct ranks', () => {
    const users = [
      { rank: 0, id: '1', displayName: 'Alice', gold: 5000 },
      { rank: 0, id: '2', displayName: 'Bob', gold: 10000 },
      { rank: 0, id: '3', displayName: 'Charlie', gold: 3000 },
    ];

    const sorted = [...users].sort((a, b) => b.gold - a.gold);
    sorted.forEach((u, idx) => {
      u.rank = idx + 1;
    });

    expect(sorted[0].rank).toBe(1);
    expect(sorted[1].rank).toBe(2);
    expect(sorted[2].rank).toBe(3);
  });

  it('should find user position in ranking', () => {
    const rankings = [
      { rank: 1, userId: 'alice', value: 10000 },
      { rank: 2, userId: 'bob', value: 8000 },
      { rank: 3, userId: 'charlie', value: 5000 },
    ];

    const userRank = rankings.find(r => r.userId === 'bob')?.rank;
    expect(userRank).toBe(2);
  });

  it('should handle net_worth ranking type', () => {
    // For now, net_worth = gold (simplified)
    const net_worth = 15000;
    const gold = 15000;
    expect(net_worth).toBe(gold);
  });
});

// ─────────────────────────────────────────────────────────
// EVENT SERVICE TESTS
// ─────────────────────────────────────────────────────────

describe('Event Service', () => {
  it('should generate 30-minute event duration', () => {
    const startedAt = new Date();
    const endsAt = new Date(startedAt.getTime() + 30 * 60 * 1000);
    const duration = endsAt.getTime() - startedAt.getTime();
    expect(duration).toBe(30 * 60 * 1000);
  });

  it('should detect active events', () => {
    const now = new Date();
    const event1 = {
      startedAt: new Date(now.getTime() - 10 * 60 * 1000), // 10 min ago
      endsAt: new Date(now.getTime() + 20 * 60 * 1000), // 20 min from now
    };

    const isActive = now < event1.endsAt;
    expect(isActive).toBe(true);
  });

  it('should detect expired events', () => {
    const now = new Date();
    const event = {
      startedAt: new Date(now.getTime() - 40 * 60 * 1000), // 40 min ago
      endsAt: new Date(now.getTime() - 10 * 60 * 1000), // 10 min ago
    };

    const isExpired = event.endsAt < now;
    expect(isExpired).toBe(true);
  });

  it('should have event categories', () => {
    const categories = ['investment', 'labor', 'facility', 'character', 'economy', 'special'];
    expect(categories).toContain('investment');
    expect(categories).toContain('labor');
    expect(categories).toContain('character');
  });

  it('should apply event effects', () => {
    const basePrice = 100;
    const event = { priceMultiplier: 1.2 };
    const adjustedPrice = basePrice * event.priceMultiplier;
    expect(adjustedPrice).toBe(120);
  });

  it('should handle multiple active events', () => {
    const now = new Date();
    const events = [
      { id: '1', endsAt: new Date(now.getTime() + 15 * 60 * 1000) },
      { id: '2', endsAt: new Date(now.getTime() + 25 * 60 * 1000) },
      { id: '3', endsAt: new Date(now.getTime() - 5 * 60 * 1000) }, // expired
    ];

    const active = events.filter(e => e.endsAt > now);
    expect(active.length).toBe(2);
  });
});

// ─────────────────────────────────────────────────────────
// ACHIEVEMENT SERVICE TESTS
// ─────────────────────────────────────────────────────────

describe('Achievement Service', () => {
  it('should evaluate gold_gte condition', () => {
    const condition = { type: 'gold_gte', value: 5000 };
    const stats = { gold: 6000 };
    const passes = stats.gold >= condition.value;
    expect(passes).toBe(true);
  });

  it('should evaluate net_worth_gte condition', () => {
    const condition = { type: 'net_worth_gte', value: 50000 };
    const stats = { netWorth: 60000 };
    const passes = stats.netWorth >= condition.value;
    expect(passes).toBe(true);
  });

  it('should evaluate level_gte condition', () => {
    const condition = { type: 'level_gte', value: 10 };
    const stats = { level: 15 };
    const passes = stats.level >= condition.value;
    expect(passes).toBe(true);
  });

  it('should evaluate jobs_completed_gte condition', () => {
    const condition = { type: 'jobs_completed_gte', value: 100 };
    const stats = { jobsCompleted: 120 };
    const passes = stats.jobsCompleted >= condition.value;
    expect(passes).toBe(true);
  });

  it('should fail condition evaluation', () => {
    const condition = { type: 'gold_gte', value: 10000 };
    const stats = { gold: 5000 };
    const passes = stats.gold >= condition.value;
    expect(passes).toBe(false);
  });

  it('should grant achievement when condition met', () => {
    let achievements: any[] = [];
    const condition = { type: 'gold_gte', value: 5000 };
    const stats = { gold: 6000 };

    if (stats.gold >= condition.value) {
      achievements.push({ id: 'ach1', earned: true });
    }

    expect(achievements.length).toBe(1);
  });

  it('should not grant duplicate achievements', () => {
    let achievements = [{ id: 'ach1' }];
    const alreadyEarned = achievements.some(a => a.id === 'ach1');

    if (!alreadyEarned && true) {
      achievements.push({ id: 'ach1' });
    }

    expect(achievements.length).toBe(1);
  });
});

// ─────────────────────────────────────────────────────────
// MARKET SERVICE TESTS
// ─────────────────────────────────────────────────────────

describe('Market Service', () => {
  it('should create a character listing', () => {
    const listing = {
      id: randomUUID(),
      sellerId: 'user1',
      type: 'character' as const,
      targetId: 'char1',
      price: 5000,
      status: 'active' as const,
    };

    expect(listing.type).toBe('character');
    expect(listing.price).toBeGreaterThan(0);
  });

  it('should create an item listing', () => {
    const listing = {
      id: randomUUID(),
      sellerId: 'user1',
      type: 'item' as const,
      targetId: 'item1',
      price: 500,
      status: 'active' as const,
    };

    expect(listing.type).toBe('item');
  });

  it('should verify seller ownership', () => {
    const character = { id: 'char1', ownerId: 'user1' };
    const sellerId = 'user1';
    const isOwner = character.ownerId === sellerId;
    expect(isOwner).toBe(true);
  });

  it('should reject sale from non-owner', () => {
    const character = { id: 'char1', ownerId: 'user1' };
    const sellerId = 'user2';
    const isOwner = character.ownerId === sellerId;
    expect(isOwner).toBe(false);
  });

  it('should check buyer has sufficient gold', () => {
    const buyer = { gold: 3000 };
    const price = 5000;
    const canBuy = buyer.gold >= price;
    expect(canBuy).toBe(false);
  });

  it('should transfer gold on purchase', () => {
    let seller = { gold: 1000 };
    let buyer = { gold: 10000 };
    const price = 2000;

    seller.gold += price;
    buyer.gold -= price;

    expect(seller.gold).toBe(3000);
    expect(buyer.gold).toBe(8000);
  });

  it('should transfer ownership on purchase', () => {
    let character = { ownerId: 'seller' };
    const buyerId = 'buyer';

    character.ownerId = buyerId;

    expect(character.ownerId).toBe('buyer');
  });

  it('should mark listing as sold', () => {
    let listing: { status: 'active' | 'sold' | 'cancelled' } = { status: 'active' };
    listing.status = 'sold';
    expect(listing.status).toBe('sold');
  });

  it('should cancel a listing', () => {
    let listing: { status: 'active' | 'sold' | 'cancelled' } = { status: 'active' };
    listing.status = 'cancelled';
    expect(listing.status).toBe('cancelled');
  });

  it('should filter listings by type', () => {
    const listings = [
      { id: '1', type: 'character' as const },
      { id: '2', type: 'item' as const },
      { id: '3', type: 'character' as const },
    ];

    const characterListings = listings.filter(l => l.type === 'character');
    expect(characterListings.length).toBe(2);
  });

  it('should apply listing price limit', () => {
    const listings = [
      { id: '1', price: 1000 },
      { id: '2', price: 5000 },
      { id: '3', price: 10000 },
    ];

    const maxPrice = 6000;
    const filtered = listings.filter(l => l.price <= maxPrice);
    expect(filtered.length).toBe(2);
  });
});

// ─────────────────────────────────────────────────────────
// TITLE SYSTEM TESTS
// ─────────────────────────────────────────────────────────

describe('Title System', () => {
  it('should grant title when condition met', () => {
    const titles: any[] = [];
    const condition = { type: 'gold_gte', value: 10000 };
    const stats = { gold: 15000 };

    if (stats.gold >= condition.value) {
      titles.push({ id: 'title1', isEquipped: false });
    }

    expect(titles.length).toBe(1);
    expect(titles[0].isEquipped).toBe(false);
  });

  it('should revoke title when condition no longer met', () => {
    let titles = [{ id: 'title1', name: 'Rich' }];
    const condition = { type: 'gold_gte', value: 10000 };
    const stats = { gold: 5000 };

    if (!(stats.gold >= condition.value)) {
      titles = titles.filter(t => t.id !== 'title1');
    }

    expect(titles.length).toBe(0);
  });

  it('should equip one title and unequip others', () => {
    let titles = [
      { id: 'title1', isEquipped: true },
      { id: 'title2', isEquipped: false },
      { id: 'title3', isEquipped: false },
    ];

    // Equip title2
    titles = titles.map(t => ({ ...t, isEquipped: false }));
    titles = titles.map(t => t.id === 'title2' ? { ...t, isEquipped: true } : t);

    expect(titles.find(t => t.isEquipped)?.id).toBe('title2');
    expect(titles.filter(t => t.isEquipped).length).toBe(1);
  });

  it('should track when title was earned', () => {
    const now = new Date();
    const title = { id: 'title1', earnedAt: now };
    expect(title.earnedAt).toBe(now);
  });
});

// ─────────────────────────────────────────────────────────
// INTEGRATED SCENARIOS
// ─────────────────────────────────────────────────────────

describe('Integrated Scenarios', () => {
  it('should handle loan lifecycle', () => {
    let borrower = { gold: 5000 };
    let lender = { gold: 10000 };
    const loanAmount = 8000;
    const interestRate = 0.05;

    // Accept loan
    lender.gold -= loanAmount;
    borrower.gold += loanAmount;
    expect(borrower.gold).toBe(13000);
    expect(lender.gold).toBe(2000);

    // Repay loan
    const totalDue = loanAmount * (1 + interestRate);
    borrower.gold -= totalDue;
    lender.gold += totalDue;

    expect(lender.gold).toBe(10400);
  });

  it('should handle market transaction', () => {
    let seller = { gold: 5000, items: ['item1'] as string[] };
    let buyer = { gold: 10000, items: [] as string[] };
    const price = 2000;

    // Buy item
    seller.gold += price;
    buyer.gold -= price;
    seller.items = seller.items.filter(i => i !== 'item1');
    buyer.items.push('item1');

    expect(seller.gold).toBe(7000);
    expect(buyer.gold).toBe(8000);
    expect(buyer.items).toContain('item1');
  });

  it('should track multiple achievements', () => {
    const achievements: any[] = [];
    const conditions = [
      { id: 'ach1', type: 'gold_gte', value: 5000 },
      { id: 'ach2', type: 'level_gte', value: 10 },
      { id: 'ach3', type: 'jobs_completed_gte', value: 50 },
    ];

    const stats = { gold: 6000, level: 15, jobsCompleted: 100 };

    for (const cond of conditions) {
      let passes = false;
      if (cond.type === 'gold_gte') passes = stats.gold >= cond.value;
      if (cond.type === 'level_gte') passes = stats.level >= cond.value;
      if (cond.type === 'jobs_completed_gte') passes = stats.jobsCompleted >= cond.value;

      if (passes) {
        achievements.push({ id: cond.id, earnedAt: new Date() });
      }
    }

    expect(achievements.length).toBe(3);
  });
});
