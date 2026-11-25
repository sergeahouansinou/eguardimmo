import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { expectNoA11yViolations } from '../../../test/axe';
import { json, renderPlatform } from '../../../test/platform';
import type { RecordedRequest } from '../../../test/platform';
import { problem, roleRequired } from '@/platform/fixtures';
import { CAMPAIGN_IDS, campaignDetail, campaignList, campaignStats, campaignSummary } from '@/platform/marketing/fixtures';
import { chooseOption } from '../abonnements/testSupport';
import { CampaignScreen } from './CampaignScreen';
import { CampaignsScreen } from './CampaignsScreen';
import { openMarketing } from './testSupport';

const SENT = { status: 'sent', recipient_count: 120, sent_count: 100, failed_count: 3, skipped_count: 17, sent_at: '2026-11-24T10:00:00+00:00' };

const list = (respond: (request: RecordedRequest) => Response) => renderPlatform(<CampaignsScreen />, respond);

describe('liste des campagnes', () => {
  it('affiche les campagnes avec leur lien et sans erreur d’accessibilité', async () => {
    const view = list(() => json(200, campaignList([campaignSummary(), campaignSummary({ id: CAMPAIGN_IDS.other, title: 'Nouveautés', ...SENT })])));

    const table = await screen.findByRole('table', { name: 'Campagnes' });
    expect(within(table).getByText('100 envoyés sur 120 · 3 en échec · 17 écartés')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Ouvrir la campagne Maintenance de novembre' }).getAttribute('href')).toBe(`/marketing/${CAMPAIGN_IDS.campaign}`);
    expect(screen.getByRole('link', { name: 'Nouvelle campagne' }).getAttribute('href')).toBe('/marketing/nouvelle');
    await expectNoA11yViolations(view.container);
  });

  it('filtre par statut et suit le curseur, en revenant à la première page', async () => {
    const view = list(() => json(200, campaignList([campaignSummary()], { has_more: true, next_cursor: 'page-2' })));
    const user = userEvent.setup();
    await screen.findByRole('table');
    await user.click(screen.getByRole('button', { name: 'Page suivante' }));
    await waitFor(() => { expect(view.requests.at(-1)?.url.searchParams.get('cursor')).toBe('page-2'); });
    await chooseOption(user, /Statut/, 'Envoyée');

    await waitFor(() => {
      expect(view.requests.at(-1)?.url.searchParams.get('status')).toBe('sent');
      expect(view.requests.at(-1)?.url.searchParams.has('cursor')).toBe(false);
    });
  });

  it('affiche l’état vide', async () => {
    list(() => json(200, campaignList([])));

    expect(await screen.findByText('Aucune campagne')).toBeTruthy();
  });

  it('signale un rôle insuffisant', async () => {
    list(() => json(403, roleRequired));

    expect(await screen.findByText('Accès réservé')).toBeTruthy();
  });
});

describe('détail d’une campagne', () => {
  it('montre les statistiques et le contenu en lecture d’une campagne envoyée', async () => {
    const view = openMarketing(<CampaignScreen id={CAMPAIGN_IDS.campaign} />, {
      campaign: () => json(200, { data: campaignDetail({ ...SENT, stats: campaignStats({ sent: 100, failed: 2, unknown: 1, unsubscribed: 4 }) }) }),
    });

    const stats = await screen.findByRole('region', { name: 'Statistiques' });
    expect(within(within(stats).getByRole('region', { name: 'Envoyés' })).getByText('100')).toBeTruthy();
    expect(within(within(stats).getByRole('region', { name: 'Désinscriptions' })).getByText('4')).toBeTruthy();
    expect(screen.getByTitle('Aperçu de l’e-mail').getAttribute('sandbox')).toBe('');
    expect(screen.queryByRole('button', { name: 'Enregistrer' })).toBeNull();
    expect(view.requests.some((request) => request.url.pathname.endsWith('/marketing/options'))).toBe(true);
    await expectNoA11yViolations(view.container, { iframes: false });
  });

  it('annonce une campagne introuvable', async () => {
    openMarketing(<CampaignScreen id={CAMPAIGN_IDS.campaign} />, { campaign: () => json(404, problem(404, 'platform_campaign_not_found', 'Introuvable.')) });

    expect(await screen.findByText('Campagne introuvable')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Retour aux campagnes' }).getAttribute('href')).toBe('/marketing');
  });
});
