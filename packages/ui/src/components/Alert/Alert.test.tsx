import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { expectNoA11yViolations } from '../../../test/axe';
import { Alert } from './Alert';

describe('Alert', () => {
  it('affiche le message avec le ton info par défaut et role status', () => {
    render(<Alert>Bail enregistré</Alert>);
    const alert = screen.getByRole('status');
    expect(alert.textContent).toBe('Bail enregistré');
    expect(alert.className).toContain('bg-info');
  });

  it.each(['info', 'success', 'warning'] as const)('le ton %s utilise role status', (tone) => {
    render(<Alert tone={tone}>Message</Alert>);
    expect(screen.getByRole('status')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('le ton danger utilise role alert', () => {
    render(<Alert tone="danger">Échec de l’envoi</Alert>);
    const alert = screen.getByRole('alert');
    expect(alert.className).toContain('bg-danger');
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('affiche un titre optionnel', () => {
    render(
      <Alert tone="warning" title="Loyer en retard">
        Relancez le locataire.
      </Alert>,
    );
    const alert = screen.getByRole('status');
    expect(alert.querySelector('strong')?.textContent).toBe('Loyer en retard');
    expect(alert.textContent).toContain('Relancez le locataire.');
  });

  it('masque l’icône aux technologies d’assistance', () => {
    const { container } = render(<Alert>Message</Alert>);
    expect(container.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('n’a aucune violation axe', async () => {
    const { container } = render(
      <div>
        <Alert title="Information">Détail</Alert>
        <Alert tone="success">Réussi</Alert>
        <Alert tone="warning">Attention</Alert>
        <Alert tone="danger" title="Erreur">
          Échec
        </Alert>
      </div>,
    );
    await expectNoA11yViolations(container);
  });
});
