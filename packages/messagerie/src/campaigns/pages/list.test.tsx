import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ApiError } from '@eguardimmo/api';
import { describe, expect, it } from 'vitest';
import { expectNoA11yViolations } from '../../../test/axe';
import { campaignPageOf, fakeCampaigns, renderCampaigns } from '../../../test/campaigns';
import { CAMPAIGN_ID, SECOND_CAMPAIGN_ID, campaignFixture, sentCampaignFixture } from '../testing';
import { CampaignsListPage } from './ListPage';

describe('liste des campagnes', () => {
  it('affiche statistiques, onglets chiffrés et lignes avec un lien adapté à l’état', async () => {
    const source = fakeCampaigns({
      list: () =>
        Promise.resolve(
          campaignPageOf([campaignFixture(), sentCampaignFixture({ id: SECOND_CAMPAIGN_ID, subject: 'Assemblée générale' })], {
            counts: { draft: 1, sent: 1 },
            stats: { this_month: 1, sent_count: 8, read_count: 4, read_rate_percent: 50 },
          }),
        ),
    });
    const { container } = renderCampaigns(<CampaignsListPage />, { source });

    const list = await screen.findByRole('list', { name: 'Campagnes' });
    const rows = within(list).getAllByRole('listitem');
    expect(rows).toHaveLength(2);
    expect(within(list).getByRole('link', { name: 'Reprendre Coupure d’eau lundi' }).getAttribute('href')).toBe(`/campagnes/${CAMPAIGN_ID}/modifier`);
    expect(within(list).getByRole('link', { name: 'Voir le suivi de Assemblée générale' }).getAttribute('href')).toBe(`/campagnes/${SECOND_CAMPAIGN_ID}`);
    expect(screen.getByText('50 %')).toBeTruthy();
    expect(screen.getByRole('tab', { name: /Brouillons/ }).textContent).toContain('1');
    expect(screen.getByRole('link', { name: 'Nouvelle campagne' }).getAttribute('href')).toBe('/campagnes/nouvelle');
    await expectNoA11yViolations(container);
  });

  it('interroge le serveur par onglet, sans filtrer localement', async () => {
    const user = userEvent.setup();
    const source = fakeCampaigns();
    renderCampaigns(<CampaignsListPage />, { source });
    await screen.findByText('Aucune campagne ici');

    await user.click(screen.getByRole('tab', { name: /Programmées/ }));

    await waitFor(() => { expect(source.list).toHaveBeenLastCalledWith(expect.objectContaining({ tab: 'scheduled' }), null); });
  });

  it('attend la fin de la saisie avant d’envoyer la recherche au serveur', async () => {
    const user = userEvent.setup();
    const source = fakeCampaigns();
    renderCampaigns(<CampaignsListPage />, { source });
    await screen.findByText('Aucune campagne ici');
    const before = source.list.mock.calls.length;

    await user.type(screen.getByRole('searchbox', { name: 'Rechercher une campagne' }), 'eau');
    expect(source.list.mock.calls.length).toBe(before);

    await waitFor(() => { expect(source.list).toHaveBeenLastCalledWith(expect.objectContaining({ search: 'eau' }), null); });
    expect(await screen.findByText('Aucune campagne ne correspond à ces filtres')).toBeTruthy();
  });

  it('charge la page suivante avec le curseur', async () => {
    const user = userEvent.setup();
    const source = fakeCampaigns({
      list: (_query, cursor) =>
        Promise.resolve(cursor === null ? campaignPageOf([campaignFixture()], { next_cursor: 'suite' }) : campaignPageOf([sentCampaignFixture({ id: SECOND_CAMPAIGN_ID, subject: 'Assemblée générale' })])),
    });
    renderCampaigns(<CampaignsListPage />, { source });

    await user.click(await screen.findByRole('button', { name: 'Afficher plus' }));

    expect(await screen.findByText('Assemblée générale')).toBeTruthy();
    expect(source.list).toHaveBeenLastCalledWith(expect.anything(), 'suite');
  });

  it('interroge de nouveau la liste tant qu’une campagne est en cours d’envoi, et s’arrête ensuite', async () => {
    let status: 'sending' | 'sent' = 'sending';
    const source = fakeCampaigns({
      list: () => Promise.resolve(campaignPageOf([campaignFixture({ status, sending_started_at: '2026-11-19T09:00:00+00:00', recipient_count: 4 })])),
    });
    const { client } = renderCampaigns(<CampaignsListPage />, { source });
    await screen.findByRole('list', { name: 'Campagnes' });
    const query = client.getQueryCache().findAll({ queryKey: ['campagnes', 'list'] })[0];
    const interval = (query?.options as { refetchInterval?: (q: unknown) => number | false }).refetchInterval;

    expect(interval?.(query)).toBe(10_000);
    status = 'sent';
    await act(async () => { await client.invalidateQueries({ queryKey: ['campagnes', 'list'] }); });
    await waitFor(() => { expect(interval?.(query)).toBe(false); });
  });

  it('propose de réessayer après une erreur et reste silencieux sur les compteurs', async () => {
    const user = userEvent.setup();
    let calls = 0;
    const source = fakeCampaigns({
      list: () => {
        calls += 1;
        return calls === 1 ? Promise.reject(new ApiError(503, 'http_503', 'Indisponible')) : Promise.resolve(campaignPageOf([campaignFixture()]));
      },
    });
    renderCampaigns(<CampaignsListPage />, { source });

    expect(await screen.findByText('Le service est momentanément indisponible. Réessayez dans un instant.')).toBeTruthy();
    expect(screen.queryByRole('list', { name: 'Campagnes' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Réessayer' }));
    expect(await screen.findByRole('list', { name: 'Campagnes' })).toBeTruthy();
  });

  it('refuse l’écran à un comptable sans appeler le serveur', async () => {
    const source = fakeCampaigns();
    renderCampaigns(<CampaignsListPage />, { source, role: 'accountant' });

    expect(await screen.findByText('Accès réservé')).toBeTruthy();
    expect(source.list).not.toHaveBeenCalled();
    expect(source.audiences).not.toHaveBeenCalled();
  });
});
