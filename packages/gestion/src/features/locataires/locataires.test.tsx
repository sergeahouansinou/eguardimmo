import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { expectNoA11yViolations } from '../../../test/axe';
import { FROZEN_NOW, norm, renderLot } from '../../../test/lots';
import { CandidatInvitePage } from './CandidatInvitePage';
import { CandidatsPage } from './CandidatsPage';
import { LocataireDetailPage } from './LocataireDetailPage';
import { LocataireFormPage } from './LocataireFormPage';
import { LocatairesPage } from './LocatairesPage';

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(FROZEN_NOW);
});
afterEach(() => {
  vi.useRealTimers();
});

describe('LocatairesPage', () => {
  it('affiche les dossiers à suivre, les compteurs d’onglets et l’alerte de retard', async () => {
    const { container } = renderLot(<LocatairesPage />);
    expect(await screen.findByRole('link', { name: 'Koffi Adjovi' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: /À suivre/ }).textContent).toContain('4');
    expect(screen.getByRole('tab', { name: /Archivés/ }).textContent).toContain('3');
    expect(norm(document.body.textContent)).toContain('850 € de loyer en retard');
    expect(screen.getByRole('link', { name: 'Ibrahim Yao' })).toBeTruthy();
    await expectNoA11yViolations(container);
  });

  it('filtre par recherche puis affiche l’état vide', async () => {
    renderLot(<LocatairesPage />);
    await screen.findByRole('link', { name: 'Koffi Adjovi' });
    await userEvent.click(screen.getByRole('tab', { name: /Tous/ }));
    await userEvent.type(screen.getByRole('searchbox', { name: 'Rechercher un locataire' }), 'moussa');
    expect(screen.getByRole('link', { name: 'Moussa Diallo' })).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Koffi Adjovi' })).toBeNull();
    await userEvent.type(screen.getByRole('searchbox', { name: 'Rechercher un locataire' }), 'zzz');
    expect(screen.getByText('Aucun locataire ne correspond à ces filtres.')).toBeTruthy();
  });

  it('refuse d’archiver un locataire au compte non soldé et le signale', async () => {
    const { sources } = renderLot(<LocatairesPage />);
    await screen.findByRole('link', { name: 'Koffi Adjovi' });
    await userEvent.click(screen.getByRole('button', { name: 'Plus d’actions, Koffi Adjovi' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Archiver' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Archiver' }));
    expect(await screen.findByText('Archivage impossible : le compte du locataire n’est pas soldé.')).toBeTruthy();
    const tenants = (await sources.tenants.tenants()) as { id: string; status: string }[];
    expect(tenants.find((tenant) => tenant.id === 'koffi-adjovi')?.status).toBe('actif');
  });

  it('archive un locataire soldé après confirmation', async () => {
    const { sources } = renderLot(<LocatairesPage />);
    await userEvent.click(await screen.findByRole('tab', { name: /Tous/ }));
    await userEvent.click(await screen.findByRole('button', { name: 'Plus d’actions, Moussa Diallo' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Archiver' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Archiver' }));
    expect(await screen.findByText('Locataire archivé')).toBeTruthy();
    const tenants = (await sources.tenants.tenants()) as { id: string; status: string }[];
    expect(tenants.find((tenant) => tenant.id === 'moussa-diallo')?.status).toBe('archive');
  });

  it('invite un locataire depuis le dialogue et valide les champs', async () => {
    const { sources } = renderLot(<LocatairesPage />);
    await screen.findByRole('link', { name: 'Koffi Adjovi' });
    await userEvent.click(screen.getByRole('button', { name: 'Inviter un locataire' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Envoyer l’invitation' }));
    expect(within(dialog).getAllByText(/obligatoire|Renseignez|Indiquez|invalide/i).length).toBeGreaterThan(0);
    await userEvent.type(within(dialog).getByLabelText('Prénom *'), 'Nora');
    await userEvent.type(within(dialog).getByLabelText('Nom *'), 'Keita');
    await userEvent.type(within(dialog).getByLabelText('E-mail *'), 'nora.keita@example.com');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Envoyer l’invitation' }));
    await waitFor(async () => {
      const tenants = (await sources.tenants.tenants()) as { id: string; status: string }[];
      expect(tenants.find((tenant) => tenant.id === 'nora-keita')?.status).toBe('invite');
    });
  });
});

describe('LocatairesPage, tableau', () => {
  it('affiche les en-têtes de colonnes en vue liste et les masque en vue cartes', async () => {
    const { container } = renderLot(<LocatairesPage />);
    await screen.findByRole('link', { name: 'Koffi Adjovi' });
    const header = () => container.querySelector('div[aria-hidden="true"].border-b')?.textContent ?? null;
    expect(header()).toBe('LocataireBienSoldeÉtat');
    await userEvent.click(screen.getByRole('radio', { name: 'Cartes' }));
    expect(header()).toBeNull();
  });

  it('change le nombre de lignes par page', async () => {
    renderLot(<LocatairesPage />);
    await userEvent.click(await screen.findByRole('tab', { name: /Tous/ }));
    expect(screen.getAllByRole('listitem').length).toBeGreaterThan(5);
    await userEvent.click(screen.getByRole('combobox', { name: /Lignes par page/ }));
    await userEvent.click(await screen.findByRole('option', { name: '5' }));
    await waitFor(() => { expect(screen.getByText('1 à 5 sur 10')).toBeTruthy(); });
  });
});

describe('LocataireFormPage', () => {
  it('affiche les erreurs sans créer de locataire', async () => {
    const { sources, push } = renderLot(<LocataireFormPage />);
    await userEvent.click(await screen.findByRole('button', { name: 'Enregistrer le locataire' }));
    expect((await screen.findAllByText(/Renseignez|Indiquez|obligatoire/i)).length).toBeGreaterThan(0);
    expect(push).not.toHaveBeenCalled();
    expect(((await sources.tenants.tenants()) as unknown[]).length).toBe(13);
  });

  it('crée un locataire puis redirige vers sa fiche', async () => {
    const { sources, push } = renderLot(<LocataireFormPage />);
    await userEvent.type(await screen.findByLabelText('Prénom *'), 'Nora');
    await userEvent.type(screen.getByLabelText('Nom *'), 'Keita');
    await userEvent.type(screen.getByLabelText('E-mail *'), 'nora.keita@example.com');
    await userEvent.type(screen.getByLabelText('Téléphone mobile *'), '+33 6 12 34 56 78');
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer le locataire' }));
    await waitFor(() => { expect(push).toHaveBeenCalledWith('/locataires/nora-keita'); });
    expect(((await sources.tenants.tenants()) as unknown[]).length).toBe(14);
  });

  it('modifie un locataire existant', async () => {
    const { sources, push } = renderLot(<LocataireFormPage id="koffi-adjovi" />);
    const phone = await screen.findByLabelText('Téléphone mobile *');
    await userEvent.clear(phone);
    await userEvent.type(phone, '+33 6 99 99 99 99');
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer les modifications' }));
    await waitFor(() => { expect(push).toHaveBeenCalledWith('/locataires/koffi-adjovi'); });
    const tenants = (await sources.tenants.tenants()) as { id: string; phone: string }[];
    expect(tenants.find((tenant) => tenant.id === 'koffi-adjovi')?.phone).toBe('+33 6 99 99 99 99');
  });

  it('signale un locataire introuvable', async () => {
    renderLot(<LocataireFormPage id="inconnu" />);
    expect(await screen.findByText('Ce locataire n’existe pas')).toBeTruthy();
  });
});

describe('LocataireDetailPage', () => {
  it('affiche la fiche de Koffi Adjovi avec ses onglets', async () => {
    const { container } = renderLot(<LocataireDetailPage id="koffi-adjovi" />);
    expect(await screen.findByRole('heading', { name: /Koffi Adjovi/ })).toBeTruthy();
    expect(screen.getByRole('tab', { name: /Baux/ })).toBeTruthy();
    await userEvent.click(screen.getByRole('tab', { name: /Paiements/ }));
    expect(screen.getByRole('tab', { name: /Paiements/ }).getAttribute('aria-selected')).toBe('true');
    await expectNoA11yViolations(container);
  });

  it('remplace le lien « Écrire » par l’action fournie par l’application, avec le locataire et ses baux', async () => {
    const writeToTenant = vi.fn(() => <button type="button">Écrire (messagerie)</button>);
    renderLot(<LocataireDetailPage id="koffi-adjovi" />, { writeToTenant });
    expect(await screen.findByRole('button', { name: 'Écrire (messagerie)' })).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Écrire' })).toBeNull();
    expect(writeToTenant).toHaveBeenCalledWith(expect.objectContaining({ partyId: 'koffi-adjovi', partyName: 'Koffi Adjovi', leases: expect.arrayContaining([expect.objectContaining({ id: 'apt-a1' })]) as unknown }));
  });

  it('garde le lien « Écrire » sans action fournie', async () => {
    renderLot(<LocataireDetailPage id="koffi-adjovi" />);
    expect((await screen.findByRole('link', { name: 'Écrire' })).getAttribute('href')).toContain('/messages/nouveau');
  });

  it('déduit l’impayé d’un locataire sans fiche détaillée', async () => {
    renderLot(<LocataireDetailPage id="clarisse-hounkpatin" />);
    expect(await screen.findByText('Échéance de novembre non réglée')).toBeTruthy();
    expect(screen.getByText(/210 € dus depuis le 01\/11\/2026/)).toBeTruthy();
    expect(screen.getByText('1 impayée, 210 €')).toBeTruthy();
  });

  it('signale un locataire introuvable avec un retour', async () => {
    renderLot(<LocataireDetailPage id="inconnu" />);
    expect(await screen.findByText('Ce locataire n’existe pas')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Retour aux locataires' }).getAttribute('href')).toBe('/locataires');
  });
});

describe('Candidats', () => {
  it('présélectionne puis confirme un candidat', async () => {
    const { sources } = renderLot(<CandidatsPage />);
    await screen.findByRole('table', { name: 'Candidats' });
    await userEvent.click(screen.getByRole('button', { name: 'Plus d’actions, Léa Martin' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Présélectionner' }));
    await waitFor(async () => {
      const candidates = (await sources.tenants.candidates()) as { id: string; status: string }[];
      expect(candidates.find((candidate) => candidate.id === 'lea-martin')?.status).toBe('preselection');
    });
  });

  it('n’envoie jamais l’identifiant d’un candidat comme destinataire d’un message', async () => {
    const { push } = renderLot(<CandidatsPage />);
    await screen.findByRole('table', { name: 'Candidats' });
    await userEvent.click(screen.getByRole('button', { name: 'Plus d’actions, Léa Martin' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Envoyer un message' }));
    expect(push).toHaveBeenLastCalledWith('/messages/nouveau');
  });

  it('écrit au locataire créé quand le candidat a été converti', async () => {
    const { sources, push } = renderLot(<CandidatsPage />);
    await screen.findByRole('table', { name: 'Candidats' });
    await userEvent.click(screen.getByRole('button', { name: 'Plus d’actions, Anna Schmidt' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Créer le bail' }));
    await waitFor(async () => {
      const candidates = (await sources.tenants.candidates()) as { id: string; tenantId: string | null }[];
      expect(candidates.find((candidate) => candidate.id === 'anna-schmidt')?.tenantId).not.toBeNull();
    });
    const converted = ((await sources.tenants.candidates()) as { id: string; tenantId: string | null }[]).find((candidate) => candidate.id === 'anna-schmidt');
    await userEvent.click(screen.getByRole('button', { name: 'Plus d’actions, Anna Schmidt' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Envoyer un message' }));
    expect(push).toHaveBeenLastCalledWith(`/messages/nouveau?destinataire=${converted?.tenantId ?? ''}`);
  });

  it('invite un candidat et redirige vers la liste', async () => {
    const { sources, push } = renderLot(<CandidatInvitePage />);
    await userEvent.type(await screen.findByLabelText('Prénom *'), 'Omar');
    await userEvent.type(screen.getByLabelText('Nom *'), 'Diop');
    await userEvent.type(screen.getByLabelText('E-mail *'), 'omar.diop@example.com');
    await userEvent.click(screen.getByRole('combobox', { name: /Bien concerné/ }));
    await userEvent.click(await screen.findByRole('option', { name: /Apt B3/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Envoyer l’invitation' }));
    await waitFor(() => { expect(push).toHaveBeenCalledWith('/locataires/candidats'); });
    const candidates = (await sources.tenants.candidates()) as { id: string }[];
    expect(candidates.some((candidate) => candidate.id === 'omar-diop')).toBe(true);
  });
});
