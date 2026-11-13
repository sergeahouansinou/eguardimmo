import { describe, expect, it } from 'vitest';
import { cx } from './cx';

describe('cx', () => {
  it('concatène les classes dans l’ordre', () => {
    expect(cx('a', 'b')).toBe('a b');
  });

  it('ignore les valeurs vides', () => {
    expect(cx('a', false, null, undefined, '', 'b')).toBe('a b');
  });

  it('gère les conditions', () => {
    const render = (active: boolean) => cx('base', active && 'on');
    expect(render(false)).toBe('base');
    expect(render(true)).toBe('base on');
  });
});
