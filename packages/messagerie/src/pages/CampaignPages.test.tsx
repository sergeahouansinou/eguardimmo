import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { expectNoA11yViolations } from '../../test/axe';
import { FIXED_NOW, brokenSource, pdf, renderMessagerie } from '../../test/render';
import { createDemoMessagerieSource } from '../data/demo';
import { campaignListSchema } from '../data/schemas';
import { CampaignsPage, NewCampaignPage } from './CampaignPages';

const allCampaigns = { tab: 'all' as const, search: '', page: 1, pageSize: 50 };

describe('CampaignsPage', () => {
  it('affiche indicateurs, campagnes et actions adaptées au statut', async () => {
    const { container } = renderMessagerie(<CampaignsPage />, { space: 'agence' });
    expect(screen.getByRole('link', { name: 'Nouvelle campagne' }).getAttribute('href')).toBe('/messages/campagnes/nouvelle');
    const list = await screen.findByRole('list', { name: 'Campagnes' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(5);
    expect(screen.getByRole('region', { name: 'Taux de lecture' }).textContent).toContain('18 lus sur 20 envois');
    expect(screen.getByRole('link', { name: 'Reprendre Fermeture du cabinet en décembre' }).getAttribute('href')).toBe(
      '/messages/campagnes/camp-fermeture',
    );
    expect(screen.getByRole('link', { name: 'Modifier Calendrier des reversements de novembre' }).getAttribute('href')).toBe(
      '/messages/campagnes/camp-reversements',
    );
    expect(screen.getByRole('link', { name: 'Messages' }).getAttribute('href')).toBe('/messages');
    await expectNoA11yViolations(container);
  });

  it('filtre par onglet et par recherche, avec état vide', async () => {
    renderMessagerie(<CampaignsPage />, { space: 'agence' });
    await screen.findByRole('list', { name: 'Campagnes' });
    await userEvent.click(screen.getByRole('tab', { name: /Brouillons/ }));
    await waitFor(() => {
      expect(within(screen.getByRole('list', { name: 'Campagnes' })).getAllByRole('listitem')).toHaveLength(1);
    });
    await userEvent.click(screen.getByRole('tab', { name: /Toutes/ }));
    await userEvent.type(screen.getByRole('searchbox', { name: 'Rechercher une campagne' }), 'zzzz');
    expect(await screen.findByText('Aucune campagne ne correspond à votre recherche')).toBeTruthy();
  });

  it('ouvre le suivi d’une campagne envoyée dans une boîte de dialogue', async () => {
    renderMessagerie(<CampaignsPage />, { space: 'agence' });
    await userEvent.click(await screen.findByRole('button', { name: 'Voir le suivi de Nouvelle adresse de paiement' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('11 sur 12 (92 %)')).toBeTruthy();
    expect(within(dialog).getByText('1 sans e-mail valide')).toBeTruthy();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Fermer' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('présente la liste en colonnes avec lus, envoi, état et échecs', async () => {
    const { container } = renderMessagerie(<CampaignsPage />, { space: 'bailleur' });
    const list = await screen.findByRole('list', { name: 'Campagnes' });
    expect(container.querySelector('div[aria-hidden="true"].bg-muted')?.textContent).toBe('CampagneDestinatairesEnvoiLusÉtat');
    const water = within(list).getByText('Coupure d’eau, lundi 16 novembre').closest('li');
    expect(water?.textContent).toContain('6 locataires');
    expect(water?.textContent).toContain('13/11/2026, 09:10');
    expect(water?.textContent).toContain('5 sur 6');
    const address = within(list).getByText('Nouvelle adresse de paiement').closest('li');
    expect(address?.textContent).toContain('Envoyée, 1 échec');
    expect(within(list).getByText('Fermeture du bureau en décembre').closest('li')?.textContent).toContain('Brouillon');
    await expectNoA11yViolations(container);
  });

  it('propose le nombre de lignes par page', async () => {
    renderMessagerie(<CampaignsPage />, { space: 'bailleur' });
    await screen.findByRole('list', { name: 'Campagnes' });
    expect(screen.getByRole('combobox', { name: /Lignes par page/ }).textContent).toContain('10');
    await userEvent.click(screen.getByRole('combobox', { name: /Lignes par page/ }));
    await userEvent.click(await screen.findByRole('option', { name: '5' }));
    await waitFor(() => { expect(screen.getByRole('combobox', { name: /Lignes par page/ }).textContent).toContain('5'); });
    expect(within(screen.getByRole('list', { name: 'Campagnes' })).getAllByRole('listitem')).toHaveLength(5);
  });

  it('affiche l’erreur de chargement', async () => {
    const base = createDemoMessagerieSource({ space: 'agence', now: () => FIXED_NOW });
    renderMessagerie(<CampaignsPage />, { space: 'agence', source: brokenSource(base, ['listCampaigns']) });
    expect((await screen.findByRole('alert')).textContent).toContain('Impossible de charger les campagnes.');
  });

  it('indique que les campagnes sont indisponibles dans un espace sans campagnes', () => {
    renderMessagerie(<CampaignsPage />, { space: 'locataire' });
    expect(screen.getByText('Les campagnes ne sont pas disponibles dans cet espace')).toBeTruthy();
  });
});

describe('NewCampaignPage', () => {
  it('valide les champs obligatoires avant tout envoi', async () => {
    const { source } = renderMessagerie(<NewCampaignPage />, { space: 'agence' });
    await userEvent.click(await screen.findByRole('button', { name: 'Envoyer' }));
    expect(await screen.findByText('Choisissez les destinataires')).toBeTruthy();
    expect(screen.getByText('Saisissez un sujet')).toBeTruthy();
    expect(screen.getByText('Saisissez votre message')).toBeTruthy();
    const list = campaignListSchema.parse(await source.listCampaigns(allCampaigns));
    expect(list.total).toBe(5);
  });

  it('insère une variable à la position du curseur', async () => {
    renderMessagerie(<NewCampaignPage />, { space: 'agence' });
    const body = await screen.findByRole<HTMLTextAreaElement>('textbox', { name: 'Message' });
    await userEvent.type(body, 'Bonjour , merci.');
    body.setSelectionRange(8, 8);
    await userEvent.click(screen.getByRole('button', { name: 'Prénom' }));
    expect(body.value).toBe('Bonjour {{Prénom}}, merci.');
  });

  it('envoie maintenant : récapitulatif, succès et campagne ajoutée à la liste', async () => {
    const { source, container } = renderMessagerie(<NewCampaignPage />, { space: 'agence' });
    await userEvent.click(await screen.findByRole('radio', { name: /Tous les locataires/ }));
    expect(screen.getByText(/12 personnes · Tous les locataires/).textContent).toContain('Expéditeur : Cabinet Delmas Immobilier');
    expect(screen.getByText(/1 destinataire sans e-mail valide/)).toBeTruthy();
    await userEvent.type(screen.getByRole('textbox', { name: 'Objet' }), 'Ramonage annuel');
    await userEvent.type(screen.getByRole('textbox', { name: 'Message' }), 'Le ramoneur passe en décembre.');
    await userEvent.upload(screen.getByLabelText('Choisir des fichiers'), pdf('planning.pdf'));
    await expectNoA11yViolations(container);
    await userEvent.click(screen.getByRole('button', { name: 'Envoyer' }));
    const success = await screen.findByText('Campagne envoyée');
    expect(success.closest('[role="status"]')?.textContent).toContain('Ramonage annuel');
    expect(screen.getByRole('link', { name: 'Retour aux campagnes' }).getAttribute('href')).toBe('/messages/campagnes');
    const list = campaignListSchema.parse(await source.listCampaigns(allCampaigns));
    expect(list.items.find((item) => item.title === 'Ramonage annuel')).toMatchObject({ status: 'envoyee', recipientCount: 12 });
  });

  it('programme l’envoi : la date est obligatoire puis la campagne est programmée', async () => {
    const { source } = renderMessagerie(<NewCampaignPage />, { space: 'agence' });
    await userEvent.click(await screen.findByRole('radio', { name: /Tous les mandants/ }));
    await userEvent.type(screen.getByRole('textbox', { name: 'Objet' }), 'Vœux');
    await userEvent.type(screen.getByRole('textbox', { name: 'Message' }), 'Bonne année à tous.');
    await userEvent.click(screen.getByRole('radio', { name: 'Programmer l’envoi' }));
    await userEvent.click(screen.getByRole('button', { name: 'Programmer l’envoi' }));
    expect(await screen.findByText('Choisissez la date et l’heure d’envoi')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Date et heure d’envoi'), { target: { value: '2026-12-31T09:00' } });
    await userEvent.click(screen.getByRole('button', { name: 'Programmer l’envoi' }));
    expect(await screen.findByText('Campagne programmée')).toBeTruthy();
    const list = campaignListSchema.parse(await source.listCampaigns(allCampaigns));
    expect(list.items.find((item) => item.title === 'Vœux')).toMatchObject({
      status: 'programmee',
      scheduledAt: '2026-12-31T09:00:00+01:00',
    });
  });

  it('affiche l’erreur de la source quand la date programmée est passée', async () => {
    renderMessagerie(<NewCampaignPage />, { space: 'agence' });
    await userEvent.click(await screen.findByRole('radio', { name: /Tous les mandants/ }));
    await userEvent.type(screen.getByRole('textbox', { name: 'Objet' }), 'Vœux');
    await userEvent.type(screen.getByRole('textbox', { name: 'Message' }), 'Bonne année.');
    await userEvent.click(screen.getByRole('radio', { name: 'Programmer l’envoi' }));
    fireEvent.change(screen.getByLabelText('Date et heure d’envoi'), { target: { value: '2026-11-01T09:00' } });
    await userEvent.click(screen.getByRole('button', { name: 'Programmer l’envoi' }));
    expect((await screen.findByRole('alert')).textContent).toContain('La date d’envoi doit être dans le futur.');
  });

  it('enregistre un brouillon sans message', async () => {
    const { source } = renderMessagerie(<NewCampaignPage />, { space: 'agence' });
    await userEvent.click(await screen.findByRole('radio', { name: /Tous les mandants/ }));
    await userEvent.type(screen.getByRole('textbox', { name: 'Objet' }), 'À finaliser');
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer le brouillon' }));
    expect(await screen.findByText('Brouillon enregistré')).toBeTruthy();
    const list = campaignListSchema.parse(await source.listCampaigns({ ...allCampaigns, tab: 'brouillon' }));
    expect(list.items.map((item) => item.title)).toContain('À finaliser');
  });

  it('reprend un brouillon existant avec ses champs préremplis puis l’envoie', async () => {
    const { source } = renderMessagerie(<NewCampaignPage campaignId="camp-fermeture" />, { space: 'agence' });
    const subject = await screen.findByRole<HTMLInputElement>('textbox', { name: 'Objet' });
    expect(subject.value).toBe('Fermeture du cabinet en décembre');
    expect(screen.getByRole<HTMLInputElement>('radio', { name: /Tous les mandants/ }).checked).toBe(true);
    expect(screen.getByRole('heading', { level: 1, name: 'Modifier la campagne' })).toBeTruthy();
    await userEvent.type(screen.getByRole('textbox', { name: 'Message' }), 'Le cabinet ferme le 24.');
    await userEvent.click(screen.getByRole('button', { name: 'Envoyer' }));
    expect(await screen.findByText('Campagne envoyée')).toBeTruthy();
    const list = campaignListSchema.parse(await source.listCampaigns(allCampaigns));
    expect(list.total).toBe(5);
    expect(list.items.find((item) => item.id === 'camp-fermeture')?.status).toBe('envoyee');
  });

  it('signale une campagne introuvable', async () => {
    renderMessagerie(<NewCampaignPage campaignId="inconnue" />, { space: 'agence' });
    expect((await screen.findByRole('alert')).textContent).toContain('Impossible de charger la campagne.');
  });

  it('affiche l’expéditeur, l’alerte des destinataires exclus et le récapitulatif du bailleur', async () => {
    renderMessagerie(<NewCampaignPage />, { space: 'bailleur' });
    expect(await screen.findByText('Expéditeur')).toBeTruthy();
    expect(screen.getByText('Réponses reçues dans Messages')).toBeTruthy();
    const recap = screen.getByRole('region', { name: 'Récapitulatif' });
    expect(within(recap).getByText(/Aucun destinataire choisi/)).toBeTruthy();
    await userEvent.click(screen.getByRole('radio', { name: /Tous les locataires/ }));
    expect(screen.getByText('1 destinataire sans e-mail valide ne recevra pas ce message.')).toBeTruthy();
    expect(screen.getByText(/Il est exclu de l’envoi/)).toBeTruthy();
    expect(within(recap).getByText('9 sur 10')).toBeTruthy();
    expect(within(recap).getByText('Tout de suite')).toBeTruthy();
    await userEvent.click(screen.getByRole('radio', { name: 'Programmer l’envoi' }));
    expect(within(recap).getByText('À programmer')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Date et heure d’envoi'), { target: { value: '2026-12-23T09:00' } });
    expect(within(recap).getByText('23/12/2026, 09:00')).toBeTruthy();
  });

  it('n’affiche pas d’alerte quand tous les destinataires ont un e-mail', async () => {
    renderMessagerie(<NewCampaignPage />, { space: 'bailleur' });
    await userEvent.click(await screen.findByRole('radio', { name: /Un ou plusieurs immeubles/ }));
    expect(screen.queryByText(/sans e-mail valide/)).toBeNull();
    expect(within(screen.getByRole('region', { name: 'Récapitulatif' })).getByText('6 sur 6')).toBeTruthy();
  });

  it('Annuler revient à la liste des campagnes', async () => {
    const { navigate } = renderMessagerie(<NewCampaignPage />, { space: 'bailleur' });
    await userEvent.click(await screen.findByRole('button', { name: 'Annuler' }));
    expect(navigate).toHaveBeenCalledWith('/messages/campagnes');
  });
});
