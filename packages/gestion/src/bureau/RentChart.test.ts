import { describe, expect, it } from 'vitest';
import { niceStep } from './RentChart';

describe('niceStep', () => {
  it.each([
    [132_500, 200_000],
    [1, 1],
    [240, 250],
    [0, 1],
  ])('arrondit %s au pas lisible %s', (raw, expected) => {
    expect(niceStep(raw)).toBe(expected);
  });
});
