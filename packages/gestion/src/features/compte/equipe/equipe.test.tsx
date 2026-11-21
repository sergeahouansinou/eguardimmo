import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { expectNoA11yViolations } from '../../../../test/axe';
import { dismissFlash } from '../../outils/kit';
import { navigate, renderScreen, screenProps } from '../shared/testing';
import { EquipeInvitePage } from './EquipeInvitePage';
import { EquipePage, seatsMessage } from './EquipePage';
import { ApiError } from '@eguardimmo/api';
import { demoTeam } from './demo';
import { SCOPE_UNSUPPORTED_MESSAGE } from './errors';
import { SeatLimitError, TeamRuleError } from './rules';
import { EquipeSourceProvider, createDemoEquipeSource, resetEquipeDemo } from './source';

beforeEach(() => {
  resetEquipeDemo();
  dismissFlash();
  navigate.mockClear();
});

const cappedTeam = { ...demoTeam, seatLimit: 3 };
const cappedSource = () => createDemoEquipeSource(cappedTeam);

function rowOf(name: string): HTMLElement {
  const email = `${name.toLowerCase().replace(' ', '.')}@example.com`;
  const row = screen.getByText(email).closest('tr');
  if (!row) throw new Error(`ligne introuvable : ${name}`);
  return row;
}

const emailOf = (name: string) => `${name.toLowerCase().replace(' ', '.')}@example.com`;

describe('EquipePage', () => {
  it('affiche les membres, les compteurs, les rôles et la sécurité de la maquette', async () => {
    const { container } = renderScreen(<EquipePage {...screenProps} />);
    expect(await screen.findByText('awa.diallo@example.com')).toBeTruthy();
    expect(screen.getByText('Formule Silver : plusieurs membres inclus.')).toBeTruthy();
    const tabs = screen.getByRole('tablist', { name: 'Filtrer les membres par état' });
    expect(within(tabs).getByRole('tab', { name: /Tous\s*4/ })).toBeTruthy();
    expect(within(tabs).getByRole('tab', { name: /Actifs\s*2/ })).toBeTruthy();
    expect(within(tabs).getByRole('tab', { name: /Invitations\s*1/ })).toBeTruthy();
    expect(within(tabs).getByRole('tab', { name: /Désactivés\s*1/ })).toBeTruthy();
    expect(within(rowOf('Marc Chevalier')).getByText('(vous)')).toBeTruthy();
    expect(within(rowOf('Fatou Ndiaye')).getByText('Invitation envoyée')).toBeTruthy();
    expect(within(rowOf('Fatou Ndiaye')).getByText("À l'acceptation")).toBeTruthy();
    expect(within(rowOf('Fatou Ndiaye')).getByText('Jamais')).toBeTruthy();
    expect(within(rowOf('Julien Morel')).getByText('Les Tilleuls (périmètre non appliqué)')).toBeTruthy();
    expect(within(rowOf('Julien Morel')).getByText('12/06/2026')).toBeTruthy();
    expect(within(rowOf('Julien Morel')).getByText('Non activée')).toBeTruthy();
    expect(within(rowOf('Awa Diallo')).getByText("Aujourd'hui, 08:42")).toBeTruthy();
    expect(within(rowOf('Marc Chevalier')).getByText('En ligne')).toBeTruthy();
    expect(screen.getByText('1 à 4 sur 4')).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Rôles' })).toBeTruthy();
    expect(screen.getByText("Tout le compte, y compris l'abonnement")).toBeTruthy();
    expect(screen.getByRole('switch', { name: 'Double authentification exigée' }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByText('Exigée pour tous les membres.')).toBeTruthy();
    expect(screen.getByRole('link', { name: "Journal d'activité" }).getAttribute('href')).toBe('/journal');
    expect(screen.getByRole('link', { name: 'Inviter un membre' }).getAttribute('href')).toBe('/equipe/inviter');
    expect(within(rowOf('Awa Diallo')).getByRole('link', { name: /Modifier/ }).getAttribute('href')).toBe('/compte');
    await expectNoA11yViolations(container);
  });

  it('masque le lien vers le journal quand l’espace n’en a pas', async () => {
    renderScreen(<EquipePage {...screenProps} journal={false} />);
    await screen.findByText('awa.diallo@example.com');
    expect(screen.queryByRole('link', { name: "Journal d'activité" })).toBeNull();
    expect(screen.getByRole('link', { name: 'Inviter un membre' })).toBeTruthy();
  });

  it('filtre par onglet, par recherche et par rôle', async () => {
    renderScreen(<EquipePage {...screenProps} />);
    await screen.findByText('awa.diallo@example.com');
    await userEvent.click(screen.getByRole('tab', { name: /Invitations/ }));
    expect(screen.getByText(emailOf('Fatou Ndiaye'))).toBeTruthy();
    expect(screen.queryByText(emailOf('Awa Diallo'))).toBeNull();
    await userEvent.click(screen.getByRole('tab', { name: /Tous/ }));
    await userEvent.type(screen.getByRole('searchbox', { name: 'Rechercher un membre' }), 'morel');
    expect(screen.getByText(emailOf('Julien Morel'))).toBeTruthy();
    expect(screen.queryByText(emailOf('Marc Chevalier'))).toBeNull();
    await userEvent.clear(screen.getByRole('searchbox', { name: 'Rechercher un membre' }));
    await userEvent.click(screen.getByRole('combobox', { name: /Filtrer par rôle/ }));
    await userEvent.click(await screen.findByRole('option', { name: 'Rôle : Comptable' }));
    expect(screen.getByText(emailOf('Fatou Ndiaye'))).toBeTruthy();
    expect(screen.queryByText(emailOf('Marc Chevalier'))).toBeNull();
  });

  it('affiche un état vide quand aucun membre ne correspond', async () => {
    renderScreen(<EquipePage {...screenProps} />);
    await screen.findByText('awa.diallo@example.com');
    await userEvent.type(screen.getByRole('searchbox', { name: 'Rechercher un membre' }), 'zzzz');
    expect(screen.getByText('Aucun membre ne correspond')).toBeTruthy();
  });

  it("renvoie une invitation depuis le bouton de la ligne et confirme", async () => {
    renderScreen(<EquipePage {...screenProps} />);
    await userEvent.click(await screen.findByRole('button', { name: /Renvoyer/ }));
    expect(await screen.findByText('Invitation renvoyée à fatou.ndiaye@example.com.')).toBeTruthy();
  });

  it("annule une invitation après confirmation et libère la place", async () => {
    const source = cappedSource();
    renderScreen(
      <EquipeSourceProvider source={source}>
        <EquipePage {...screenProps} />
      </EquipeSourceProvider>,
    );
    await userEvent.click(await screen.findByRole('button', { name: "Plus d'actions pour Fatou Ndiaye" }));
    await userEvent.click(await screen.findByRole('menuitem', { name: "Annuler l'invitation" }));
    const dialog = await screen.findByRole('dialog', { name: "Annuler l'invitation de Fatou Ndiaye ?" });
    await userEvent.click(within(dialog).getByRole('button', { name: "Annuler l'invitation" }));
    expect(await screen.findByText("Invitation de Fatou Ndiaye annulée.")).toBeTruthy();
    expect((await source.getTeam()).members.map((member) => member.id)).not.toContain('fatou-ndiaye');
    expect(await screen.findByText('Formule Silver : 2 membres actifs sur 3. 1 place disponible.')).toBeTruthy();
  });

  it('change le rôle d’un membre', async () => {
    const source = createDemoEquipeSource();
    renderScreen(
      <EquipeSourceProvider source={source}>
        <EquipePage {...screenProps} />
      </EquipeSourceProvider>,
    );
    await userEvent.click(await screen.findByRole('button', { name: "Plus d'actions pour Fatou Ndiaye" }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Modifier le rôle' }));
    const dialog = await screen.findByRole('dialog', { name: 'Modifier le rôle de Fatou Ndiaye' });
    await userEvent.click(within(dialog).getByRole('radio', { name: /Gestionnaire/ }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Enregistrer' }));
    expect(await screen.findByText('Rôle de Fatou Ndiaye : Gestionnaire.')).toBeTruthy();
    expect((await source.getTeam()).members.find((member) => member.id === 'fatou-ndiaye')?.role).toBe('gestionnaire');
  });

  it('propose de rétablir « Tous les biens » seulement pour un membre au périmètre non appliqué', async () => {
    const source = createDemoEquipeSource();
    renderScreen(
      <EquipeSourceProvider source={source}>
        <EquipePage {...screenProps} />
      </EquipeSourceProvider>,
    );
    await userEvent.click(await screen.findByRole('button', { name: "Plus d'actions pour Fatou Ndiaye" }));
    expect(screen.queryByRole('menuitem', { name: /Tous les biens/ })).toBeNull();
    expect(screen.queryByRole('menuitem', { name: 'Modifier les biens accessibles' })).toBeNull();
    await userEvent.keyboard('{Escape}');

    expect(within(rowOf('Julien Morel')).getByText('Les Tilleuls (périmètre non appliqué)')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: "Plus d'actions pour Julien Morel" }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Rétablir « Tous les biens »' }));
    const dialog = await screen.findByRole('dialog', { name: "Rétablir l'accès à tous les biens pour Julien Morel ?" });
    expect(within(dialog).queryByRole('radio')).toBeNull();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Rétablir « Tous les biens »' }));
    expect(await screen.findByText('Julien Morel a accès à tous les biens.')).toBeTruthy();
    expect((await source.getTeam()).members.find((member) => member.id === 'julien-morel')?.scope).toEqual({ type: 'all' });
  });

  it('affiche le refus member_scope_unsupported du serveur en français', async () => {
    const source = createDemoEquipeSource();
    source.changeScope = () => Promise.reject(new ApiError(422, 'member_scope_unsupported', 'Texte du serveur', {}, null));
    renderScreen(
      <EquipeSourceProvider source={source}>
        <EquipePage {...screenProps} />
      </EquipeSourceProvider>,
    );
    await userEvent.click(await screen.findByRole('button', { name: "Plus d'actions pour Julien Morel" }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Rétablir « Tous les biens »' }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Rétablir « Tous les biens »' }));
    expect(await screen.findByText(SCOPE_UNSUPPORTED_MESSAGE)).toBeTruthy();
    expect(screen.queryByText('Texte du serveur')).toBeNull();
  });

  it('désactive un membre actif après confirmation, puis le réactive', async () => {
    const source = createDemoEquipeSource();
    await source.cancelInvitation('fatou-ndiaye');
    await source.reactivate('julien-morel');
    renderScreen(
      <EquipeSourceProvider source={source}>
        <EquipePage {...screenProps} />
      </EquipeSourceProvider>,
    );
    await userEvent.click(await screen.findByRole('button', { name: "Plus d'actions pour Julien Morel" }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Désactiver' }));
    const dialog = await screen.findByRole('dialog', { name: 'Désactiver Julien Morel ?' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Désactiver' }));
    expect(await screen.findByText('Julien Morel a été désactivé.')).toBeTruthy();
    await userEvent.click(await screen.findByRole('button', { name: /Réactiver/ }));
    expect(await screen.findByText('Julien Morel est de nouveau actif.')).toBeTruthy();
  });

  it('retire un membre avec confirmation', async () => {
    const source = createDemoEquipeSource();
    renderScreen(
      <EquipeSourceProvider source={source}>
        <EquipePage {...screenProps} />
      </EquipeSourceProvider>,
    );
    await userEvent.click(await screen.findByRole('button', { name: "Plus d'actions pour Julien Morel" }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Retirer du compte' }));
    const dialog = await screen.findByRole('dialog', { name: 'Retirer Julien Morel du compte ?' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Garder' }));
    expect((await source.getTeam()).members.map((member) => member.id)).toContain('julien-morel');
    await userEvent.click(await screen.findByRole('button', { name: "Plus d'actions pour Julien Morel" }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Retirer du compte' }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Retirer du compte' }));
    expect(await screen.findByText('Julien Morel a été retiré du compte.')).toBeTruthy();
    expect((await source.getTeam()).members.map((member) => member.id)).not.toContain('julien-morel');
  });

  it("interdit de retirer ou désactiver l'administrateur unique (menu désactivé)", async () => {
    renderScreen(<EquipePage {...screenProps} />);
    await userEvent.click(await screen.findByRole('button', { name: "Plus d'actions pour Marc Chevalier" }));
    const remove = await screen.findByRole('menuitem', { name: /Retirer du compte/ });
    expect(remove.getAttribute('aria-disabled')).toBe('true');
    expect(screen.getByRole('menuitem', { name: /Désactiver/ }).getAttribute('aria-disabled')).toBe('true');
    expect(screen.getByRole('menuitem', { name: /Modifier le rôle/ }).getAttribute('aria-disabled')).toBe('true');
  });

  it('modifie la double authentification exigée', async () => {
    const source = createDemoEquipeSource();
    renderScreen(
      <EquipeSourceProvider source={source}>
        <EquipePage {...screenProps} />
      </EquipeSourceProvider>,
    );
    await userEvent.click(await screen.findByRole('switch', { name: 'Double authentification exigée' }));
    expect(await screen.findByText('Double authentification facultative pour les membres.')).toBeTruthy();
    expect((await source.getTeam()).twoFactorRequired).toBe(false);
  });

  it('affiche une erreur de chargement', async () => {
    const source = { ...createDemoEquipeSource(), getTeam: () => Promise.reject(new Error('panne')) };
    renderScreen(
      <EquipeSourceProvider source={source}>
        <EquipePage {...screenProps} />
      </EquipeSourceProvider>,
    );
    expect(await screen.findByText("L'équipe n'a pas pu être chargée")).toBeTruthy();
  });

  it('affiche l’erreur renvoyée par la source quand une action est refusée', async () => {
    const base = createDemoEquipeSource();
    const source = { ...base, resendInvitation: () => Promise.reject(new TeamRuleError('Action refusée par le serveur.')) };
    renderScreen(
      <EquipeSourceProvider source={source}>
        <EquipePage {...screenProps} />
      </EquipeSourceProvider>,
    );
    await userEvent.click(await screen.findByRole('button', { name: /Renvoyer/ }));
    expect(await screen.findByText('Action refusée par le serveur.')).toBeTruthy();
  });
});

describe('règles de l’équipe (source)', () => {
  it('refuse de retirer le titulaire, soi-même ou de modifier ces rôles', async () => {
    const source = createDemoEquipeSource();
    await expect(source.remove('awa-diallo')).rejects.toThrow('titulaire');
    await expect(source.remove('marc-chevalier')).rejects.toThrow('vous-même');
    await expect(source.deactivate('marc-chevalier')).rejects.toThrow(TeamRuleError);
    await expect(source.changeRole('marc-chevalier', 'comptable')).rejects.toThrow(TeamRuleError);
    await expect(source.changeRole('awa-diallo', 'comptable')).rejects.toThrow(TeamRuleError);
    expect((await source.getTeam()).members).toHaveLength(4);
  });

  it("refuse de retirer, désactiver ou rétrograder l'administrateur unique", async () => {
    const withoutOwner = {
      ...demoTeam,
      members: demoTeam.members.filter((member) => member.id !== 'awa-diallo').map((member) => (member.id === 'marc-chevalier' ? { ...member, self: false } : member)),
    };
    const source = createDemoEquipeSource(withoutOwner);
    await expect(source.remove('marc-chevalier')).rejects.toThrow('administrateur unique');
    await expect(source.deactivate('marc-chevalier')).rejects.toThrow('administrateur unique');
    await expect(source.changeRole('marc-chevalier', 'gestionnaire')).rejects.toThrow('administrateur unique');
    expect((await source.getTeam()).members.map((member) => member.id)).toContain('marc-chevalier');
  });

  it('refuse une invitation au-delà des places et une adresse déjà présente', async () => {
    const source = cappedSource();
    const input = { firstName: 'Ibrahim', lastName: 'Yao', email: 'ibrahim.yao@example.com', role: 'gestionnaire' as const, scope: { type: 'all' as const }, message: '' };
    await expect(source.invite(input)).rejects.toBeInstanceOf(SeatLimitError);
    await source.cancelInvitation('fatou-ndiaye');
    await expect(source.invite({ ...input, email: 'MARC.chevalier@example.com' })).rejects.toThrow('déjà membre');
    const created = await source.invite(input);
    expect(created.status).toBe('invite');
    expect((await source.getTeam()).members).toHaveLength(4);
  });

  it('compte les places sur les membres actifs et invités uniquement', () => {
    expect(seatsMessage(cappedTeam)).toContain('2 membres actifs sur 3');
    expect(seatsMessage(demoTeam)).toBe('Formule Silver : plusieurs membres inclus.');
    expect(seatsMessage({ ...cappedTeam, members: cappedTeam.members.filter((member) => member.status === 'actif') })).toContain('1 place disponible.');
  });
});

describe('EquipeInvitePage', () => {
  async function freeSeatSource() {
    const source = cappedSource();
    await source.cancelInvitation('fatou-ndiaye');
    return source;
  }

  it('affiche le formulaire de la maquette avec rôle Comptable par défaut et droits associés', async () => {
    const source = await freeSeatSource();
    const { container } = renderScreen(
      <EquipeSourceProvider source={source}>
        <EquipeInvitePage {...screenProps} />
      </EquipeSourceProvider>,
    );
    expect(await screen.findByPlaceholderText('Ex. : Fatou')).toBeTruthy();
    expect(screen.getByPlaceholderText('Ex. : fatou.ndiaye@example.com')).toBeTruthy();
    expect(screen.getByPlaceholderText('Ex. : Bonjour Fatou, voici ton accès pour suivre les loyers.')).toBeTruthy();
    expect(screen.getByText("L'invitation est envoyée à cette adresse.")).toBeTruthy();
    expect(screen.getByText('Le membre reçoit un lien valable 7 jours pour créer son accès.')).toBeTruthy();
    expect(screen.getByRole<HTMLInputElement>('radio', { name: /Comptable/ }).checked).toBe(true);
    const rights = await screen.findByRole('region', { name: 'Droits du rôle' });
    expect(within(rights).getByText('Loyers, encaissements, dépenses')).toBeTruthy();
    expect(within(rights).getAllByText('Modifier')).toHaveLength(1);
    expect(within(rights).getAllByText('Modifier, 2FA')).toHaveLength(1);
    expect(within(rights).getAllByText('Lecture')).toHaveLength(3);
    expect(within(rights).getAllByText('Aucun')).toHaveLength(2);
    expect(screen.getByText('Double authentification exigée à la connexion.')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Annuler' }).getAttribute('href')).toBe('/equipe');
    await expectNoA11yViolations(container);
  });

  it("n'offre plus de périmètre par bien et l'explique", async () => {
    const source = await freeSeatSource();
    renderScreen(
      <EquipeSourceProvider source={source}>
        <EquipeInvitePage {...screenProps} />
      </EquipeSourceProvider>,
    );
    const card = await screen.findByRole('region', { name: 'Biens accessibles' });
    expect(within(card).getByText('Tous les biens')).toBeTruthy();
    expect(within(card).getByText(/n'est pas appliqué par le serveur/)).toBeTruthy();
    expect(screen.queryByRole('radio', { name: 'Biens choisis' })).toBeNull();
    expect(screen.queryByRole('checkbox', { name: 'Les Tilleuls' })).toBeNull();
  });

  it("affiche le refus member_scope_unsupported du serveur à l'invitation", async () => {
    const source = await freeSeatSource();
    source.invite = () => Promise.reject(new ApiError(422, 'member_scope_unsupported', 'Texte du serveur', {}, null));
    renderScreen(
      <EquipeSourceProvider source={source}>
        <EquipeInvitePage {...screenProps} />
      </EquipeSourceProvider>,
    );
    await userEvent.type(await screen.findByLabelText('Prénom *'), 'Ibrahim');
    await userEvent.type(screen.getByLabelText('Nom *'), 'Yao');
    await userEvent.type(screen.getByLabelText('E-mail *'), 'ibrahim.yao@example.com');
    await userEvent.click(screen.getByRole('button', { name: "Envoyer l'invitation" }));
    expect(await screen.findByText(SCOPE_UNSUPPORTED_MESSAGE)).toBeTruthy();
    expect(navigate).not.toHaveBeenCalled();
  });

  it("affiche la limite de membres du plan avec le lien vers l'abonnement", async () => {
    const source = await freeSeatSource();
    source.invite = () => Promise.reject(new ApiError(409, 'plan_quota_reached', 'Texte du serveur', {}, null, { feature: 'users', limit: 3, current: 3 }));
    renderScreen(
      <EquipeSourceProvider source={source}>
        <EquipeInvitePage {...screenProps} />
      </EquipeSourceProvider>,
    );
    await userEvent.type(await screen.findByLabelText('Prénom *'), 'Ibrahim');
    await userEvent.type(screen.getByLabelText('Nom *'), 'Yao');
    await userEvent.type(screen.getByLabelText('E-mail *'), 'ibrahim.yao@example.com');
    await userEvent.click(screen.getByRole('button', { name: "Envoyer l'invitation" }));
    expect(await screen.findByText(/Limite de votre plan atteinte : 3 membres sur 3\./)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Voir mon abonnement' }).getAttribute('href')).toBe('/compte/abonnement');
    expect(screen.queryByText("L'invitation n'a pas pu être envoyée")).toBeNull();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('met à jour les droits affichés quand le rôle change', async () => {
    const source = await freeSeatSource();
    renderScreen(
      <EquipeSourceProvider source={source}>
        <EquipeInvitePage {...screenProps} />
      </EquipeSourceProvider>,
    );
    await userEvent.click(await screen.findByRole('radio', { name: /Administrateur/ }));
    const rights = await screen.findByRole('region', { name: 'Droits du rôle' });
    expect(within(rights).getAllByText('Modifier')).toHaveLength(6);
    expect(within(rights).getAllByText('Modifier, 2FA')).toHaveLength(1);
  });

  it('valide prénom, nom et e-mail avec un message par champ, sans appeler la source', async () => {
    const source = await freeSeatSource();
    renderScreen(
      <EquipeSourceProvider source={source}>
        <EquipeInvitePage {...screenProps} />
      </EquipeSourceProvider>,
    );
    await userEvent.type(await screen.findByLabelText('E-mail *'), 'pas-un-mail');
    await userEvent.click(screen.getByRole('button', { name: "Envoyer l'invitation" }));
    expect(screen.getByText('Saisissez le prénom.')).toBeTruthy();
    expect(screen.getByText('Saisissez le nom.')).toBeTruthy();
    expect(screen.getByText(/Saisissez une adresse e-mail valide/)).toBeTruthy();
    expect(navigate).not.toHaveBeenCalled();
    expect((await source.getTeam()).members).toHaveLength(3);
  });

  it('envoie l’invitation, ajoute le membre en attente et redirige avec un message', async () => {
    const source = await freeSeatSource();
    renderScreen(
      <EquipeSourceProvider source={source}>
        <EquipeInvitePage {...screenProps} />
      </EquipeSourceProvider>,
    );
    await userEvent.type(await screen.findByLabelText('Prénom *'), 'Ibrahim');
    await userEvent.type(screen.getByLabelText('Nom *'), 'Yao');
    await userEvent.type(screen.getByLabelText('E-mail *'), 'ibrahim.yao@example.com');
    await userEvent.click(screen.getByRole('radio', { name: /Gestionnaire/ }));
    await userEvent.type(screen.getByLabelText('Message personnel'), 'Bienvenue');
    await userEvent.click(screen.getByRole('button', { name: "Envoyer l'invitation" }));
    await waitFor(() => { expect(navigate).toHaveBeenCalledWith('/equipe'); });
    const created = (await source.getTeam()).members.find((member) => member.email === 'ibrahim.yao@example.com');
    expect(created).toMatchObject({ role: 'gestionnaire', status: 'invite', scope: { type: 'all' }, message: 'Bienvenue' });
  });

  it('bloque l’envoi quand toutes les places sont utilisées', async () => {
    renderScreen(
      <EquipeSourceProvider source={cappedSource()}>
        <EquipeInvitePage {...screenProps} />
      </EquipeSourceProvider>,
    );
    expect(await screen.findByText('Aucune place disponible')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'changez de formule' }).getAttribute('href')).toBe('/compte/abonnement');
    expect(screen.getByRole('button', { name: "Envoyer l'invitation" }).hasAttribute('disabled')).toBe(true);
  });

  it("affiche l'erreur de la source si l'adresse est déjà membre", async () => {
    const source = await freeSeatSource();
    renderScreen(
      <EquipeSourceProvider source={source}>
        <EquipeInvitePage {...screenProps} />
      </EquipeSourceProvider>,
    );
    await userEvent.type(await screen.findByLabelText('Prénom *'), 'Awa');
    await userEvent.type(screen.getByLabelText('Nom *'), 'Diallo');
    await userEvent.type(screen.getByLabelText('E-mail *'), 'awa.diallo@example.com');
    await userEvent.click(screen.getByRole('button', { name: "Envoyer l'invitation" }));
    expect(await screen.findByText('Cette adresse e-mail est déjà membre ou invitée.')).toBeTruthy();
    expect(navigate).not.toHaveBeenCalled();
  });
});
