import { ApiError } from '@eguardimmo/api';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { renderLot } from '../../../test/lots';
import { translateApiError } from './api/apiErrors';
import { BailFormPage } from './BailFormPage';
import { EtatLieuxFormPage } from './EtatLieuxFormPage';

function quotaReached(feature: string, current: number, limit: number): Error {
  const translated = translateApiError(new ApiError(409, 'plan_quota_reached', 'Texte serveur.', {}, null, { feature, limit, current }));
  if (!(translated instanceof Error)) throw new Error('Erreur traduite attendue');
  return translated;
}

describe('limites de plan, baux et états des lieux', () => {
  it('affiche la limite de baux avec le lien vers l’abonnement et ne redirige pas', async () => {
    const { sources, push } = renderLot(<BailFormPage />, { search: 'bien=apt-b3' });
    sources.baux.createLease = () => Promise.reject(quotaReached('leases', 30, 30));
    await userEvent.click(await screen.findByRole('button', { name: 'Enregistrer en brouillon' }));
    expect(await screen.findByText(/Limite de votre plan atteinte : 30 baux sur 30\./)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Voir mon abonnement' }).getAttribute('href')).toBe('/compte/abonnement');
    expect(push).not.toHaveBeenCalled();
  });

  it('affiche la limite d’états des lieux avec le lien vers l’abonnement', async () => {
    const { sources, push } = renderLot(<EtatLieuxFormPage />, { search: 'bien=apt-a1' });
    sources.baux.createEdl = () => Promise.reject(quotaReached('inspections', 5, 5));
    await userEvent.click(await screen.findByRole('button', { name: 'Créer et commencer le relevé' }));
    expect(await screen.findByText(/Limite de votre plan atteinte : 5 états des lieux sur 5\./)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Voir mon abonnement' }).getAttribute('href')).toBe('/compte/abonnement');
    expect(push).not.toHaveBeenCalled();
  });

  it('retire l’alerte au nouvel enregistrement réussi', async () => {
    const { sources, push } = renderLot(<EtatLieuxFormPage />, { search: 'bien=apt-a1' });
    const create = sources.baux.createEdl.bind(sources.baux);
    sources.baux.createEdl = () => Promise.reject(quotaReached('inspections', 5, 5));
    await userEvent.click(await screen.findByRole('button', { name: 'Créer et commencer le relevé' }));
    expect(await screen.findByRole('link', { name: 'Voir mon abonnement' })).toBeTruthy();
    sources.baux.createEdl = create;
    await userEvent.click(screen.getByRole('button', { name: 'Créer et commencer le relevé' }));
    await screen.findByRole('button', { name: 'Créer et commencer le relevé' });
    expect(push).toHaveBeenCalled();
    expect(screen.queryByRole('link', { name: 'Voir mon abonnement' })).toBeNull();
  });
});
