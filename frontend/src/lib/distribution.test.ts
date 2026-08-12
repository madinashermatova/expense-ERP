import { describe, it, expect } from 'vitest';
import { distributeEqually } from './distribution';

describe('distributeEqually', () => {
  it('divides evenly when possible', () => {
    expect(distributeEqually(150000, 3)).toEqual([50000, 50000, 50000]);
  });

  it('gives remainder to the first recipient (cents)', () => {
    expect(distributeEqually(100000, 3)).toEqual([33333.34, 33333.33, 33333.33]);
  });

  it('handles multiple cents remainder correctly', () => {
    expect(distributeEqually(100, 3)).toEqual([33.34, 33.33, 33.33]);
  });

  it('returns empty array if count is 0', () => {
    expect(distributeEqually(100000, 0)).toEqual([]);
  });
});
