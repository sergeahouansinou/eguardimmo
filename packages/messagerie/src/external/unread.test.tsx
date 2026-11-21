import { act, screen } from '@testing-library/react';
import { ApiError } from '@eguardimmo/api';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fakeSource, renderExternal } from '../../test/external';
import { useUnreadMessages } from './queries';

function Counter() {
  const count = useUnreadMessages();
  return <p>{count === undefined ? 'inconnu' : `${String(count)} non lus`}</p>;
}

afterEach(() => {
  vi.useRealTimers();
  Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
});

describe('compteur de messages non lus', () => {
  it('affiche le total servi puis le rafraîchit toutes les 60 secondes', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const counts = [3, 0];
    const source = fakeSource({ unreadCount: () => Promise.resolve(counts.shift() ?? 0) });
    renderExternal(<Counter />, { source });

    expect(await screen.findByText('3 non lus')).toBeTruthy();
    await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
    expect(source.unreadCount).toHaveBeenCalledTimes(1);
    await act(async () => { await vi.advanceTimersByTimeAsync(31_000); });
    expect(await screen.findByText('0 non lus')).toBeTruthy();
    expect(source.unreadCount).toHaveBeenCalledTimes(2);
  });

  it('reste inconnu quand le serveur échoue, sans afficher zéro', async () => {
    const source = fakeSource({ unreadCount: () => Promise.reject(new ApiError(503, 'x', 'brut')) });
    renderExternal(<Counter />, { source });

    await vi.waitFor(() => { expect(source.unreadCount).toHaveBeenCalled(); });
    expect(screen.getByText('inconnu')).toBeTruthy();
  });

  it('suspend l’interrogation quand l’onglet est caché', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const source = fakeSource({ unreadCount: () => Promise.resolve(1) });
    renderExternal(<Counter />, { source });
    await screen.findByText('1 non lus');

    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    await act(async () => { await vi.advanceTimersByTimeAsync(180_000); });

    expect(source.unreadCount).toHaveBeenCalledTimes(1);
  });
});
