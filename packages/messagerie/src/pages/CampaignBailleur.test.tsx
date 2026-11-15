import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { expectNoA11yViolations } from '../../test/axe';
import { FIXED_NOW, brokenSource, renderMessagerie } from '../../test/render';
import { createDemoMessagerieSource } from '../data/demo';
import type { MessagerieSource } from '../data/source';
import { campaignListSchema, campaignSchema } from '../data/schemas';
import { CampaignsPage, NewCampaignPage } from './CampaignPages';

const everything = { tab: 'all' as const, search: '', building: 'all', period: 'all' as const, page: 1, pageSize: 50 };

async function addBuilding(name: RegExp) {
  await userEvent.click(screen.getByRole('combobox', { name: /Immeubles à ajouter/ }));
  await userEvent.click(await screen.findByRole('option', { name }));
}

describe('composition de l’audience par immeuble (bailleur)', () => {
  it('ajoute et retire des immeubles : total, destinataires sans e-mail exclus et libellés d’envoi', async () => {
    const { container } = renderMessagerie(<NewCampaignPage />, { space: 'bailleur' });
    await userEvent.click(await screen.findByRole('radio', { name: /Un ou plusieurs immeubles/ }));
    const recap = screen.getByRole('region', { name: 'Récapitulatif' });
    expect(within(recap).getByText(/Aucun destinataire choisi/)).toBeTruthy();
    expect(screen.getByText('Aucun immeuble ajouté.')).toBeTruthy();

    await addBuilding(/Les Tilleuls/);
    expect(within(screen.getByRole('list', { name: 'Immeubles choisis' })).getByText('Les Tilleuls')).toBeTruthy();
    expect(screen.getByText('1 destinataire sans e-mail valide ne recevra pas ce message.')).toBeTruthy();
    expect(within(recap).getByText('5 sur 6')).toBeTruthy();
    expect(within(recap).getByText(/6 locataires · Les Tilleuls/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Envoyer' }).textContent).toBe('Envoyer à 5 locataires');

    await addBuilding(/Résidence du Parc/);
    expect(within(recap).getByText('8 sur 9')).toBeTruthy();
    expect(within(recap).getByText(/9 locataires · Les Tilleuls, Résidence du Parc/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Envoyer' }).textContent).toBe('Envoyer à 8 locataires');
    await expectNoA11yViolations(container);

    await userEvent.click(screen.getByRole('button', { name: 'Retirer Les Tilleuls' }));
    expect(screen.queryByText(/sans e-mail valide/)).toBeNull();
    expect(within(recap).getByText('3 sur 3')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Envoyer' }).textContent).toBe('Envoyer à 3 locataires');
  });

  it('libellé de programmation avec le nombre de locataires atteints', async () => {
    renderMessagerie(<NewCampaignPage />, { space: 'bailleur' });
    await userEvent.click(await screen.findByRole('radio', { name: /Un ou plusieurs immeubles/ }));
    await addBuilding(/Les Tilleuls/);
    await userEvent.click(screen.getByRole('radio', { name: 'Programmer l’envoi' }));
    expect(screen.getByRole('button', { name: 'Programmer pour 5 locataires' })).toBeTruthy();
    await addBuilding(/Maison Rivière/);
    expect(screen.getByRole('button', { name: 'Programmer pour 6 locataires' })).toBeTruthy();
  });

  it('exige au moins un immeuble avant l’envoi', async () => {
    const { source } = renderMessagerie(<NewCampaignPage />, { space: 'bailleur' });
    await userEvent.click(await screen.findByRole('radio', { name: /Un ou plusieurs immeubles/ }));
    await userEvent.type(screen.getByRole('textbox', { name: 'Objet' }), 'Ramonage');
    await userEvent.type(screen.getByRole('textbox', { name: 'Message' }), 'Jeudi matin.');
    await userEvent.click(screen.getByRole('button', { name: 'Envoyer' }));
    expect(await screen.findByText('Ajoutez au moins un immeuble')).toBeTruthy();
    expect(campaignListSchema.parse(await source.listCampaigns(everything)).total).toBe(5);
  });

  it('enregistre la campagne avec les immeubles choisis et ses destinataires exclus', async () => {
    const { source } = renderMessagerie(<NewCampaignPage />, { space: 'bailleur' });
    await userEvent.click(await screen.findByRole('radio', { name: /Un ou plusieurs immeubles/ }));
    await addBuilding(/Les Tilleuls/);
    await addBuilding(/Résidence du Parc/);
    await userEvent.type(screen.getByRole('textbox', { name: 'Objet' }), 'Ramonage');
    await userEvent.type(screen.getByRole('textbox', { name: 'Message' }), 'Jeudi matin.');
    await userEvent.click(screen.getByRole('button', { name: 'Envoyer' }));
    expect(await screen.findByText('Campagne envoyée')).toBeTruthy();
    const saved = campaignListSchema.parse(await source.listCampaigns(everything)).items.find((item) => item.title === 'Ramonage');
    expect(saved).toMatchObject({
      audienceLabel: 'Les Tilleuls, Résidence du Parc',
      buildingIds: ['b-tilleuls', 'b-parc'],
      recipientCount: 9,
      failedCount: 1,
    });
  });

  it('envoie une audience fixe sans immeubles à composer et la rattache à tous les immeubles', async () => {
    const { source } = renderMessagerie(<NewCampaignPage />, { space: 'bailleur' });
    await userEvent.click(await screen.findByRole('radio', { name: /Tous les locataires/ }));
    expect(screen.queryByRole('group', { name: 'Immeubles' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Envoyer' }).textContent).toBe('Envoyer à 9 locataires');
    await userEvent.type(screen.getByRole('textbox', { name: 'Objet' }), 'Ramonage');
    await userEvent.type(screen.getByRole('textbox', { name: 'Message' }), 'Jeudi matin.');
    await userEvent.click(screen.getByRole('button', { name: 'Envoyer' }));
    expect(await screen.findByText('Campagne envoyée')).toBeTruthy();
    const saved = campaignListSchema.parse(await source.listCampaigns(everything)).items.find((item) => item.title === 'Ramonage');
    expect(saved).toMatchObject({ audienceLabel: 'Tous les locataires', recipientCount: 10, buildingIds: ['b-tilleuls', 'b-parc', 'b-riviere'] });
  });

  it('reprend un brouillon par immeuble avec ses immeubles préremplis', async () => {
    const source = createDemoMessagerieSource({ space: 'bailleur', now: () => FIXED_NOW });
    const draft = campaignSchema.parse(
      await source.saveCampaign({
        id: null,
        audienceId: 'aud-immeubles',
        buildingIds: ['b-riviere'],
        subject: 'Visite',
        body: '',
        mode: 'draft',
        scheduledAt: null,
        copyToHistory: true,
        attachments: [],
      }),
    );
    renderMessagerie(<NewCampaignPage campaignId={draft.id} />, { space: 'bailleur', source });
    const chosen = await screen.findByRole('list', { name: 'Immeubles choisis' });
    expect(within(chosen).getByText('Maison Rivière')).toBeTruthy();
  });

  it('ne propose pas la composition par immeuble ni le comptage dans l’espace agence', async () => {
    renderMessagerie(<NewCampaignPage />, { space: 'agence' });
    await userEvent.click(await screen.findByRole('radio', { name: /Un ou plusieurs immeubles/ }));
    expect(screen.queryByRole('group', { name: 'Immeubles' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Envoyer' }).textContent).toBe('Envoyer');
    expect(screen.queryByRole('button', { name: 'Recevoir un test' })).toBeNull();
  });
});

describe('source : composition d’audience', () => {
  const base = {
    id: null,
    audienceId: 'aud-immeubles',
    subject: 'Ramonage',
    body: 'Jeudi.',
    mode: 'now' as const,
    scheduledAt: null,
    copyToHistory: true,
    attachments: [],
  };
  const create = () => createDemoMessagerieSource({ space: 'bailleur', now: () => FIXED_NOW });

  it('refuse une audience par immeuble sans immeuble, avec un immeuble inconnu, ou un immeuble sur une audience fixe', async () => {
    const source = create();
    await expect(source.saveCampaign({ ...base, buildingIds: [] })).rejects.toThrow(/au moins un immeuble/);
    await expect(source.saveCampaign({ ...base, buildingIds: ['b-inconnu'] })).rejects.toThrow(/Immeuble introuvable/);
    await expect(source.saveCampaign({ ...base, audienceId: 'aud-locataires', buildingIds: ['b-parc'] })).rejects.toThrow(
      /ne se composent pas par immeuble/,
    );
  });

  it('accepte un brouillon sans immeuble', async () => {
    const draft = campaignSchema.parse(await create().saveCampaign({ ...base, buildingIds: [], mode: 'draft' }));
    expect(draft).toMatchObject({ status: 'brouillon', recipientCount: 0, buildingIds: [] });
  });
});

describe('recevoir un test (bailleur)', () => {
  function setup(source: MessagerieSource = createDemoMessagerieSource({ space: 'bailleur', now: () => FIXED_NOW })) {
    return renderMessagerie(<NewCampaignPage />, { space: 'bailleur', source });
  }

  it('envoie le message courant à l’adresse de l’utilisateur avec des valeurs d’exemple', async () => {
    const source = createDemoMessagerieSource({ space: 'bailleur', now: () => FIXED_NOW });
    setup(source);
    fireEvent.change(await screen.findByRole('textbox', { name: 'Objet' }), { target: { value: 'Ramonage chez {{Prénom}}' } });
    fireEvent.change(screen.getByRole('textbox', { name: 'Message' }), { target: { value: 'Bonjour {{Prénom}}, jeudi pour {{Bien}}.' } });
    await userEvent.click(screen.getByRole('button', { name: 'Recevoir un test' }));
    const feedback = await screen.findByText('Test envoyé à marc.chevalier@example.com');
    expect(feedback.closest('[role="status"]')).toBeTruthy();
    expect(source.sentCampaignTests()).toEqual([
      {
        to: 'marc.chevalier@example.com',
        subject: 'Ramonage chez Koffi',
        body: 'Bonjour Koffi, jeudi pour Apt A1.',
        attachmentNames: [],
        sentAt: FIXED_NOW.toISOString(),
      },
    ]);
    expect(campaignListSchema.parse(await source.listCampaigns(everything)).total).toBe(5);
  });

  it('affiche l’état de chargement pendant l’envoi', async () => {
    const base = createDemoMessagerieSource({ space: 'bailleur', now: () => FIXED_NOW });
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    setup({ ...base, sendCampaignTest: async (input) => { await gate; return base.sendCampaignTest(input); } });
    await userEvent.type(await screen.findByRole('textbox', { name: 'Objet' }), 'Ramonage');
    await userEvent.type(screen.getByRole('textbox', { name: 'Message' }), 'Jeudi.');
    await userEvent.click(screen.getByRole('button', { name: 'Recevoir un test' }));
    await waitFor(() => { expect(screen.getByRole('button', { name: 'Recevoir un test' }).getAttribute('aria-busy')).toBe('true'); });
    expect(screen.queryByText(/Test envoyé/)).toBeNull();
    release();
    expect(await screen.findByText(/Test envoyé à/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Recevoir un test' }).getAttribute('aria-busy')).toBeNull();
  });

  it('affiche l’erreur quand l’envoi échoue, sans succès silencieux', async () => {
    const base = createDemoMessagerieSource({ space: 'bailleur', now: () => FIXED_NOW });
    setup(brokenSource(base, ['sendCampaignTest']));
    await userEvent.type(await screen.findByRole('textbox', { name: 'Objet' }), 'Ramonage');
    await userEvent.type(screen.getByRole('textbox', { name: 'Message' }), 'Jeudi.');
    await userEvent.click(screen.getByRole('button', { name: 'Recevoir un test' }));
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('Envoi du test impossible');
    expect(alert.textContent).toContain('Service indisponible');
    expect(screen.queryByText(/Test envoyé/)).toBeNull();
    expect(base.sentCampaignTests()).toHaveLength(0);
  });

  it('refuse un sujet ou un message vide sans appeler la source', async () => {
    const source = createDemoMessagerieSource({ space: 'bailleur', now: () => FIXED_NOW });
    setup(source);
    await userEvent.click(await screen.findByRole('button', { name: 'Recevoir un test' }));
    expect(await screen.findByText('Saisissez un sujet')).toBeTruthy();
    expect(screen.getByText('Saisissez votre message')).toBeTruthy();
    expect(source.sentCampaignTests()).toHaveLength(0);
    await expect(source.sendCampaignTest({ subject: ' ', body: 'x', attachments: [] })).rejects.toThrow('Saisissez un sujet');
  });
});

describe('filtres de la liste des campagnes (bailleur)', () => {
  const titles = () => within(screen.getByRole('list', { name: 'Campagnes' })).getAllByRole('listitem').map((item) => item.textContent);

  it('filtre par immeuble et met à jour les effectifs des onglets', async () => {
    renderMessagerie(<CampaignsPage />, { space: 'bailleur' });
    await screen.findByRole('list', { name: 'Campagnes' });
    await userEvent.click(screen.getByRole('combobox', { name: /Immeuble/ }));
    await userEvent.click(await screen.findByRole('option', { name: 'Résidence du Parc' }));
    await waitFor(() => { expect(titles()).toHaveLength(4); });
    expect(titles().some((text) => text.includes('Coupure d’eau'))).toBe(false);
    expect(screen.getByRole('tab', { name: /Toutes/ }).textContent).toContain('4');
    expect(screen.getByRole('tab', { name: /Envoyées/ }).textContent).toContain('2');
  });

  it('filtre par période, drafts non datés conservés', async () => {
    renderMessagerie(<CampaignsPage />, { space: 'bailleur' });
    await screen.findByRole('list', { name: 'Campagnes' });
    await userEvent.click(screen.getByRole('combobox', { name: /Période/ }));
    await userEvent.click(await screen.findByRole('option', { name: 'Ce mois-ci' }));
    await waitFor(() => { expect(titles()).toHaveLength(4); });
    expect(titles().some((text) => text.includes('Nouvelle adresse de paiement'))).toBe(false);
    expect(titles().some((text) => text.includes('Fermeture du bureau'))).toBe(true);
  });

  it('affiche un état vide dédié quand les filtres ne retiennent rien', async () => {
    const source = createDemoMessagerieSource({ space: 'bailleur', now: () => FIXED_NOW });
    renderMessagerie(<CampaignsPage />, { space: 'bailleur', source });
    await screen.findByRole('list', { name: 'Campagnes' });
    await userEvent.click(screen.getByRole('combobox', { name: /Immeuble/ }));
    await userEvent.click(await screen.findByRole('option', { name: 'Maison Rivière' }));
    await userEvent.click(screen.getByRole('tab', { name: /Envoyées/ }));
    await userEvent.click(screen.getByRole('combobox', { name: /Période/ }));
    await userEvent.click(await screen.findByRole('option', { name: 'Ce mois-ci' }));
    expect(await screen.findByText('Aucune campagne ne correspond à ces filtres')).toBeTruthy();
  });

  it('n’affiche pas les filtres dans l’espace agence', async () => {
    renderMessagerie(<CampaignsPage />, { space: 'agence' });
    await screen.findByRole('list', { name: 'Campagnes' });
    expect(screen.queryByRole('combobox', { name: /Immeuble/ })).toBeNull();
    expect(screen.queryByRole('combobox', { name: /Période/ })).toBeNull();
  });
});

describe('source : filtres et pagination', () => {
  const source = createDemoMessagerieSource({ space: 'bailleur', now: () => FIXED_NOW });

  it('garde un total et une pagination cohérents avec les filtres', async () => {
    const parc = campaignListSchema.parse(await source.listCampaigns({ ...everything, building: 'b-parc', pageSize: 2 }));
    expect(parc.total).toBe(4);
    expect(parc.items).toHaveLength(2);
    const second = campaignListSchema.parse(await source.listCampaigns({ ...everything, building: 'b-parc', pageSize: 2, page: 2 }));
    expect(second.items).toHaveLength(2);
    expect(new Set([...parc.items, ...second.items].map((item) => item.id)).size).toBe(4);
    expect(parc.counts).toMatchObject({ all: 4, envoyee: 2, programmee: 1, brouillon: 1 });
  });

  it('combine immeuble, période et onglet', async () => {
    const list = campaignListSchema.parse(
      await source.listCampaigns({ ...everything, tab: 'envoyee', building: 'b-tilleuls', period: 'month' }),
    );
    expect(list.items.map((item) => item.id)).toEqual(['camp-eau', 'camp-assurance']);
    expect(list.total).toBe(2);
  });

  it('ne retient rien pour un immeuble inconnu', async () => {
    const list = campaignListSchema.parse(await source.listCampaigns({ ...everything, building: 'b-inconnu' }));
    expect(list).toMatchObject({ total: 0, items: [], counts: { all: 0 } });
  });
});
