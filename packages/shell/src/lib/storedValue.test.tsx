import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useStoredValue } from './storedValue';

afterEach(() => { window.localStorage.clear(); });

describe('useStoredValue', () => {
  it('renvoie la valeur par défaut puis la valeur mémorisée', () => {
    const { result } = renderHook(() => useStoredValue('eg-test', ['a', 'b'] as const, 'a'));
    expect(result.current[0]).toBe('a');
    act(() => { result.current[1]('b'); });
    expect(result.current[0]).toBe('b');
    expect(window.localStorage.getItem('eg-test')).toBe('b');
  });

  it('ignore une valeur stockée hors de la liste autorisée', () => {
    window.localStorage.setItem('eg-test', 'x');
    const { result } = renderHook(() => useStoredValue('eg-test', ['a', 'b'] as const, 'a'));
    expect(result.current[0]).toBe('a');
  });
});
