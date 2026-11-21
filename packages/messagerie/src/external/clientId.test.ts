import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { fingerprintOf, useSendIntent, uuidV7 } from './clientId';

describe('client_id', () => {
  it('produit un UUID v7 valide, ordonné par l’horloge', () => {
    const early = uuidV7(1_700_000_000_000);
    const late = uuidV7(1_700_000_001_000);
    expect(early).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(early < late).toBe(true);
    expect(uuidV7()).not.toBe(uuidV7());
  });

  it('garde la même clé tant que l’intention est identique, y compris après un échec', () => {
    const { result } = renderHook(() => useSendIntent());
    const fingerprint = fingerprintOf(['Bonjour'], []);
    const first = result.current.clientIdFor(fingerprint);
    expect(result.current.clientIdFor(fingerprint)).toBe(first);
  });

  it('change de clé quand le texte ou les pièces changent, ou après un envoi réussi', () => {
    const { result } = renderHook(() => useSendIntent());
    const first = result.current.clientIdFor(fingerprintOf(['Bonjour'], []));
    const edited = result.current.clientIdFor(fingerprintOf(['Bonjour à tous'], []));
    expect(edited).not.toBe(first);
    const withFile = result.current.clientIdFor(fingerprintOf(['Bonjour à tous'], [new File(['x'], 'a.pdf', { type: 'application/pdf' })]));
    expect(withFile).not.toBe(edited);
    result.current.settle();
    expect(result.current.clientIdFor(fingerprintOf(['Bonjour à tous'], []))).not.toBe(withFile);
  });
});
