import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ApiError } from '@eguardimmo/api';
import { describe, expect, it } from 'vitest';
import { expectNoA11yViolations } from '../../../test/axe';
import { campaignOf, fakeCampaigns, renderCampaigns } from '../../../test/campaigns';
import { ATTACHMENT_ID, CAMPAIGN_ID, EMPTY_METRICS, sendingCampaignFixture, sentCampaignFixture } from '../testing';
import { CampaignDetailPage } from './DetailPage';

const SCHEDULED = { status: 'scheduled', scheduled_at: '2026-11-20T09:00:00+00:00', lock_version: 2 } as const;

describe('détail d’une campagne', () => {
  it('affiche le suivi d’une campagne envoyée : traités, lus, échecs et rappel sur le suivi', async () => {
    const source = fakeCampaigns({ get: () => Promise.resolve(campaignOf(sentCampaignFixture())) });
    const { container } = renderCampaigns(<CampaignDetailPage campaignId={CAMPAIGN_ID} />, { source });

    const metrics = await screen.findByRole('region', { name: 'Suivi de l’envoi' });
    expect(within(metrics).getByText('10 sur 10 traités')).toBeTruthy();
    expect(within(metrics).getByRole('img', { name: 'Avancement de l’envoi : 100 %' })).toBeTruthy();
    expect(within(metrics).getByText('1 envoi en échec')).toBeTruthy();
    expect(within(metrics).getByText(/l’e-mail n’est pas suivi/)).toBeTruthy();
    expect(screen.getByText('Envoyée')).toBeTruthy();
    await expectNoA11yViolations(container);
  });

  it('rend le message comme du texte : aucun HTML injecté', async () => {
    const hostile = '<img src=x onerror="window.pwned=1"><script>window.pwned=2</script> **gras**';
    const source = fakeCampaigns({ get: () => Promise.resolve(campaignOf({ body: hostile })) });
    renderCampaigns(<CampaignDetailPage campaignId={CAMPAIGN_ID} />, { source });

    const section = await screen.findByRole('region', { name: 'Message' });
    expect(section.querySelector('img')).toBeNull();
    expect(section.querySelector('script')).toBeNull();
    expect(section.querySelector('strong')).toBeNull();
    expect(section.textContent).toContain('<img src=x onerror="window.pwned=1">');
  });

  it('propose de reprendre un brouillon', async () => {
    renderCampaigns(<CampaignDetailPage campaignId={CAMPAIGN_ID} />);
    expect((await screen.findByRole('link', { name: 'Reprendre le brouillon' })).getAttribute('href')).toBe(`/campagnes/${CAMPAIGN_ID}/modifier`);
    expect(screen.queryByRole('button', { name: 'Annuler la programmation' })).toBeNull();
  });

  it('annule une campagne programmée seulement après confirmation', async () => {
    const user = userEvent.setup();
    const source = fakeCampaigns({ get: () => Promise.resolve(campaignOf(SCHEDULED)) });
    renderCampaigns(<CampaignDetailPage campaignId={CAMPAIGN_ID} />, { source });

    await user.click(await screen.findByRole('button', { name: 'Annuler la programmation' }));
    const dialog = await screen.findByRole('dialog', { name: 'Annuler la programmation ?' });
    expect(source.cancel).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole('button', { name: 'Annuler la programmation' }));

    await waitFor(() => { expect(source.cancel).toHaveBeenCalledWith(CAMPAIGN_ID); });
    await waitFor(() => { expect(screen.queryByRole('dialog')).toBeNull(); });
    expect(screen.getByText('Annulée')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Annuler la programmation' })).toBeNull();
  });

  it('garde la campagne programmée quand on renonce à l’annulation', async () => {
    const user = userEvent.setup();
    const source = fakeCampaigns({ get: () => Promise.resolve(campaignOf(SCHEDULED)) });
    renderCampaigns(<CampaignDetailPage campaignId={CAMPAIGN_ID} />, { source });

    await user.click(await screen.findByRole('button', { name: 'Annuler la programmation' }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Annuler' }));

    expect(source.cancel).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Annuler la programmation' })).toBeTruthy();
  });

  it('explique un refus d’annulation (409 : déjà partie)', async () => {
    const user = userEvent.setup();
    const source = fakeCampaigns({
      get: () => Promise.resolve(campaignOf(SCHEDULED)),
      cancel: () => Promise.reject(new ApiError(409, 'campaign_not_editable', 'x')),
    });
    renderCampaigns(<CampaignDetailPage campaignId={CAMPAIGN_ID} />, { source });

    await user.click(await screen.findByRole('button', { name: 'Annuler la programmation' }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Annuler la programmation' }));

    expect(await screen.findByText('Annulation impossible')).toBeTruthy();
    expect(screen.getByText(/Seul un brouillon se modifie/)).toBeTruthy();
  });

  it('rafraîchit toutes les 10 secondes pendant l’envoi, puis s’arrête', async () => {
    let campaign = campaignOf(sendingCampaignFixture());
    const source = fakeCampaigns({ get: () => Promise.resolve(campaign) });
    const { client } = renderCampaigns(<CampaignDetailPage campaignId={CAMPAIGN_ID} />, { source });
    await screen.findByText('4 sur 10 traités');
    expect(screen.getByText(/les chiffres se mettent à jour automatiquement/)).toBeTruthy();
    const query = client.getQueryCache().find({ queryKey: ['campagnes', 'one', CAMPAIGN_ID] });
    const interval = (query?.options as { refetchInterval?: (q: unknown) => number | false }).refetchInterval;

    expect(interval?.(query)).toBe(10_000);
    campaign = campaignOf(sentCampaignFixture());
    await client.invalidateQueries({ queryKey: ['campagnes', 'one', CAMPAIGN_ID] });
    await screen.findByText('10 sur 10 traités');
    expect(interval?.(query)).toBe(false);
  });

  it('télécharge une pièce jointe de la campagne', async () => {
    const user = userEvent.setup();
    const source = fakeCampaigns({ get: () => Promise.resolve(campaignOf({ attachments: [{ id: ATTACHMENT_ID, name: 'avis.pdf', size_bytes: 2048 }] })) });
    renderCampaigns(<CampaignDetailPage campaignId={CAMPAIGN_ID} />, { source });

    await screen.findByText('avis.pdf');
    await user.click(screen.getByRole('button', { name: 'Télécharger avis.pdf' }));

    await waitFor(() => { expect(source.downloadAttachment).toHaveBeenCalledWith(CAMPAIGN_ID, { id: ATTACHMENT_ID, name: 'avis.pdf', sizeBytes: 2048 }); });
    expect(screen.queryByRole('button', { name: /Retirer/ })).toBeNull();
  });

  it('signale un contenu effacé à l’échéance de conservation', async () => {
    const source = fakeCampaigns({ get: () => Promise.resolve(campaignOf(sentCampaignFixture({ content_purged: true, subject: 'Objet conservé', body: '' }))) });
    renderCampaigns(<CampaignDetailPage campaignId={CAMPAIGN_ID} />, { source });
    expect(await screen.findByText('Contenu effacé')).toBeTruthy();
  });

  it('affiche l’absence de la campagne et propose de réessayer en cas de panne', async () => {
    const user = userEvent.setup();
    let calls = 0;
    const source = fakeCampaigns({
      get: () => (++calls === 1 ? Promise.reject(new ApiError(404, 'campaign_not_found', 'x')) : Promise.resolve(campaignOf({ metrics: EMPTY_METRICS }))),
    });
    renderCampaigns(<CampaignDetailPage campaignId={CAMPAIGN_ID} />, { source });

    expect(await screen.findByText('Cette campagne n’existe pas ou n’est plus accessible.')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Réessayer' }));
    expect(await screen.findByRole('link', { name: 'Reprendre le brouillon' })).toBeTruthy();
  });

  it('refuse l’écran à un comptable sans appeler le serveur', async () => {
    const source = fakeCampaigns();
    renderCampaigns(<CampaignDetailPage campaignId={CAMPAIGN_ID} />, { source, role: 'accountant' });
    expect(await screen.findByText('Accès réservé')).toBeTruthy();
    expect(source.get).not.toHaveBeenCalled();
  });
});
