import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { OrgApiError } from './errors';
import { QueryState } from './QueryState';
import { renderWithOrg } from './testing';

const NOT_FOUND = { title: 'Tâche introuvable', description: 'Absente.', backHref: '/taches', backLabel: 'Retour aux tâches' };
const base = { label: 'Chargement', title: 'Impossible de charger' };

function failure(kind: ConstructorParameters<typeof OrgApiError>[0], message = 'Erreur serveur'): Error {
  return new OrgApiError(kind, message);
}

describe('QueryState', () => {
  it('affiche le chargement tant que la requête est en cours', () => {
    renderWithOrg(<QueryState {...base} query={{ isPending: true, isError: false, error: null }} />);

    expect(screen.getByRole('status', { name: 'Chargement' })).toBeTruthy();
  });

  it('ne rend rien quand la requête a réussi', () => {
    const { container } = renderWithOrg(<QueryState {...base} query={{ isPending: false, isError: false, error: null }} />);

    expect(container.textContent).toBe('');
  });

  it('propose de réessayer après une erreur', async () => {
    const onRetry = vi.fn();
    renderWithOrg(<QueryState {...base} query={{ isPending: false, isError: true, error: failure('unavailable') }} onRetry={onRetry} />);

    await userEvent.click(screen.getByRole('button', { name: 'Réessayer' }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('signale un accès refusé', () => {
    renderWithOrg(<QueryState {...base} query={{ isPending: false, isError: true, error: failure('forbidden', 'Droit manquant') }} />);

    expect(screen.getByText('Accès refusé')).toBeTruthy();
  });

  it('signale une ressource introuvable', () => {
    renderWithOrg(<QueryState {...base} notFound={NOT_FOUND} query={{ isPending: false, isError: true, error: failure('not_found') }} />);

    expect(screen.getByText('Tâche introuvable')).toBeTruthy();
  });
});
