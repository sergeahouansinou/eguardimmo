import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TooltipProvider } from '../Tooltip/Tooltip';
import { ToastProvider, useToast } from './Toast';

function Trigger({ tone }: { tone?: 'danger' }) {
  const toast = useToast();
  return (
    <button type="button" onClick={() => { toast.show({ title: 'Lot enregistré', description: 'Apt A3', tone }); }}>
      Annoncer
    </button>
  );
}

function setup(tone?: 'danger') {
  return render(
    <TooltipProvider>
      <ToastProvider durationMs={1000}>
        <Trigger tone={tone} />
      </ToastProvider>
    </TooltipProvider>,
  );
}

afterEach(() => {
  vi.useRealTimers();
});

describe('Toast', () => {
  it('affiche un message de succès dans une région live', async () => {
    setup();
    await userEvent.click(screen.getByRole('button', { name: 'Annoncer' }));
    const message = screen.getByRole('status');
    expect(message.textContent).toContain('Lot enregistré');
    expect(message.textContent).toContain('Apt A3');
  });

  it('annonce une erreur avec le rôle alerte', async () => {
    setup('danger');
    await userEvent.click(screen.getByRole('button', { name: 'Annoncer' }));
    expect(screen.getByRole('alert').textContent).toContain('Lot enregistré');
  });

  it('se ferme à la demande', async () => {
    setup();
    await userEvent.click(screen.getByRole('button', { name: 'Annoncer' }));
    await userEvent.click(screen.getByRole('button', { name: 'Fermer la notification' }));
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('disparaît après le délai', () => {
    vi.useFakeTimers();
    setup();
    act(() => { screen.getByRole('button', { name: 'Annoncer' }).click(); });
    expect(screen.getByRole('status')).toBeTruthy();
    act(() => { vi.advanceTimersByTime(1100); });
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('exige un fournisseur', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => render(<Trigger />)).toThrow('ToastProvider');
    spy.mockRestore();
  });
});
