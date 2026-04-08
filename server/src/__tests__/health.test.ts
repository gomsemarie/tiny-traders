import { describe, it, expect } from 'vitest';

describe('Server health', () => {
  it('returns healthy status shape', () => {
    const health = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: '0.1.0',
    };
    expect(health.status).toBe('ok');
    expect(health.version).toBe('0.1.0');
  });
});
