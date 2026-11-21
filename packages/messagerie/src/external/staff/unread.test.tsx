import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen } from '@testing-library/react';
import { ApiError } from '@eguardimmo/api';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fakeStaffSource, renderStaff } from '../../../test/staff';
import { totalUnread, useOptionalStaffUnread } from './unread';

function Counter() {
  const unread = useOptionalStaffUnread();
  return <p>{unread === undefined ? 'inconnu' : `${String(totalUnread(unread))} non lus`}</p>;
}

afterEach(() => {
  vi.useRealTimers();
  Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
});

describe('compteur de non-lus de la navigation', () => {
  it('additionne équipe, locataires et mandants puis se rafraîchit toutes les 60 secondes', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const answers = [{ internal: 1, tenant: 2, owner: 3 }, { internal: 0, tenant: 0, owner: 0 }];
    const source = fakeStaffSource({ unread: () => Promise.resolve(answers.shift() ?? { internal: 0, tenant: 0, owner: 0 }) });
    renderStaff(<Counter />, { source });

    expect(await screen.findByText('6 non lus')).toBeTruthy();
    await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
    expect(source.unread).toHaveBeenCalledTimes(1);
    await act(async () => { await vi.advanceTimersByTimeAsync(31_000); });
    expect(await screen.findByText('0 non lus')).toBeTruthy();
  });

  it('reste inconnu quand le serveur échoue, sans afficher zéro', async () => {
    const source = fakeStaffSource({ unread: () => Promise.reject(new ApiError(503, 'unavailable', 'brut')) });
    renderStaff(<Counter />, { source });
    await vi.waitFor(() => { expect(source.unread).toHaveBeenCalled(); });
    expect(screen.getByText('inconnu')).toBeTruthy();
  });

  it('reste inconnu et n’interroge rien sans messagerie externe', () => {
    const client = new QueryClient();
    render(<QueryClientProvider client={client}><Counter /></QueryClientProvider>);
    expect(screen.getByText('inconnu')).toBeTruthy();
  });
});
