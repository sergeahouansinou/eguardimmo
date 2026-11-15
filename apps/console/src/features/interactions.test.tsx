import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { auditListSchema, equipeSchema, organisationDetailSchema, rgpdDetailSchema } from '@/console/schemas';
import type { ConsoleSource } from '@/console/source';
import { router } from '../../test/navigation';
import { renderWithConsole } from '../../test/render';
import { EquipeScreen } from './equipe/EquipeScreen';
import { InviteScreen } from './equipe/InviteScreen';
import { OrganisationDetailScreen } from './organisations/OrganisationDetailScreen';
import { OrganisationsScreen } from './organisations/OrganisationsScreen';
import { NotificationsScreen } from './parametres/NotificationsScreen';
import { RgpdDetailScreen } from './rgpd/RgpdDetailScreen';

async function auditTotal(source: ConsoleSource): Promise<number> {
  return auditListSchema.parse(await source.audit.list({ pageSize: 1 })).total;
}

describe('organisations : liste', () => {
  it('filtre par recherche puis efface les filtres', async () => {
    renderWithConsole(<OrganisationsScreen />);
    const user = userEvent.setup();
    const search = await screen.findByRole('searchbox', { name: 'Rechercher une organisation' });
    await user.type(search, 'delmas');
    await waitFor(() => { expect(screen.getAllByRole('link', { name: /Ouvrir/ }).length).toBeLessThan(5); });
    expect(screen.getAllByRole('link', { name: /Ouvrir Cabinet Delmas/ }).length).toBeGreaterThan(0);
    await user.clear(search);
    await user.type(search, 'zzzz-introuvable');
    expect(await screen.findByText('Aucune organisation ne correspond')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Effacer les filtres' }));
    expect((await screen.findAllByRole('link', { name: /Ouvrir/ })).length).toBeGreaterThan(5);
  });
});

describe('organisation : suspension', () => {
  it('demande confirmation avec motif, suspend et consigne au journal', async () => {
    const { source } = renderWithConsole(<OrganisationDetailScreen id="cabinet-delmas-immobilier" />);
    const user = userEvent.setup();
    const before = await auditTotal(source);
    await user.click(await screen.findByRole('button', { name: 'Suspendre' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Suspendre l’organisation' }));
    expect(await within(dialog).findByText(/5 caractères minimum/)).toBeTruthy();
    expect(await auditTotal(source)).toBe(before);
    await user.type(within(dialog).getByLabelText('Motif'), 'Impayé de plus de 60 jours');
    await user.click(within(dialog).getByRole('button', { name: 'Suspendre l’organisation' }));
    await waitFor(() => { expect(screen.queryByRole('dialog')).toBeNull(); });
    expect(await auditTotal(source)).toBe(before + 1);
    expect(organisationDetailSchema.parse(await source.organisations.get('cabinet-delmas-immobilier')).organisation.state).toBe('suspendue');
  });

  it('annuler ne change rien', async () => {
    const { source } = renderWithConsole(<OrganisationDetailScreen id="cabinet-delmas-immobilier" />);
    const user = userEvent.setup();
    const before = await auditTotal(source);
    await user.click(await screen.findByRole('button', { name: 'Suspendre' }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Annuler' }));
    await waitFor(() => { expect(screen.queryByRole('dialog')).toBeNull(); });
    expect(await auditTotal(source)).toBe(before);
  });

  it('affiche l’erreur du serveur dans le dialogue sans le fermer', async () => {
    const { source } = renderWithConsole(<OrganisationDetailScreen id="cabinet-delmas-immobilier" />);
    vi.spyOn(source.organisations, 'suspend').mockRejectedValueOnce(new Error('panne'));
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Suspendre' }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText('Motif'), 'Fraude suspectée');
    await user.click(within(dialog).getByRole('button', { name: 'Suspendre l’organisation' }));
    expect(await within(dialog).findByRole('alert')).toBeTruthy();
    expect(screen.getByRole('dialog')).toBeTruthy();
  });
});

describe('équipe', () => {
  it('filtre par recherche', async () => {
    renderWithConsole(<EquipeScreen />);
    const user = userEvent.setup();
    await user.type(await screen.findByRole('searchbox', { name: 'Rechercher un opérateur' }), 'garnier');
    await waitFor(() => { expect(screen.queryByText('Théo Marchand')).toBeNull(); });
    expect(screen.getByText('Inès Garnier')).toBeTruthy();
  });

  it('désactivation : confirmation, effet et journal', async () => {
    const { source } = renderWithConsole(<EquipeScreen />);
    const user = userEvent.setup();
    const before = await auditTotal(source);
    const row = (await screen.findByText('Théo Marchand')).closest('tr');
    expect(row).not.toBeNull();
    await user.click(within(row as HTMLElement).getByRole('button', { name: 'Désactiver' }));
    const dialog = await screen.findByRole('dialog');
    expect(await auditTotal(source)).toBe(before);
    await user.click(within(dialog).getByRole('button', { name: 'Désactiver l’accès' }));
    await waitFor(() => { expect(screen.queryByRole('dialog')).toBeNull(); });
    const team = equipeSchema.parse(await source.equipe.list());
    expect(team.operators.find((operator) => operator.id === 'theo-marchand')?.state).toBe('desactive');
    expect(await auditTotal(source)).toBe(before + 1);
  });

  it('ne propose aucune action sur son propre compte', async () => {
    renderWithConsole(<EquipeScreen />);
    const row = (await screen.findByText('Lucas Bernard')).closest('tr');
    expect(within(row as HTMLElement).queryByRole('button')).toBeNull();
  });
});

describe('invitation', () => {
  it('signale les champs obligatoires', async () => {
    const { source } = renderWithConsole(<InviteScreen />);
    const invite = vi.spyOn(source.equipe, 'invite');
    await userEvent.setup().click(screen.getByRole('button', { name: 'Envoyer l’invitation' }));
    expect(await screen.findByText('Indiquez le prénom.')).toBeTruthy();
    expect(screen.getByText('Indiquez le nom.')).toBeTruthy();
    expect(invite).not.toHaveBeenCalled();
  });

  it('affiche les droits du rôle choisi', async () => {
    renderWithConsole(<InviteScreen />);
    const user = userEvent.setup();
    const droits = screen.getByRole('region', { name: /Droits du rôle support/i });
    expect(within(droits).getAllByText('Aucun accès').length).toBeGreaterThan(0);
    await user.click(screen.getByRole('radio', { name: /Finance/ }));
    expect(screen.getByRole('region', { name: /Droits du rôle finance/i })).toBeTruthy();
  });

  it('envoie l’invitation, la consigne et redirige vers l’équipe', async () => {
    router.push.mockClear();
    const { source } = renderWithConsole(<InviteScreen />);
    const user = userEvent.setup();
    const before = await auditTotal(source);
    await user.type(screen.getByLabelText('Prénom *'), 'Camille');
    await user.type(screen.getByLabelText('Nom *'), 'Martin');
    await user.type(screen.getByLabelText('E-mail professionnel *'), 'camille.martin@eguardimmo.example');
    await user.click(screen.getByRole('radio', { name: /Finance/ }));
    await user.click(screen.getByRole('button', { name: 'Envoyer l’invitation' }));
    await waitFor(() => { expect(router.push).toHaveBeenCalledWith('/equipe'); });
    expect(await auditTotal(source)).toBe(before + 1);
    const team = equipeSchema.parse(await source.equipe.list());
    expect(team.operators.find((operator) => operator.email === 'camille.martin@eguardimmo.example')?.role).toBe('finance');
  });

  it('affiche le refus du serveur pour un e-mail déjà utilisé', async () => {
    router.push.mockClear();
    renderWithConsole(<InviteScreen />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Prénom *'), 'Inès');
    await user.type(screen.getByLabelText('Nom *'), 'Garnier');
    await user.type(screen.getByLabelText('E-mail professionnel *'), 'ines.garnier@eguardimmo.example');
    await user.click(screen.getByRole('button', { name: 'Envoyer l’invitation' }));
    expect(await screen.findByText(/existe déjà/)).toBeTruthy();
    expect(router.push).not.toHaveBeenCalled();
  });
});

describe('notifications', () => {
  it('active le bouton d’enregistrement après une modification puis enregistre', async () => {
    const { source } = renderWithConsole(<NotificationsScreen />);
    const user = userEvent.setup();
    const save = await screen.findByRole('button', { name: /Enregistrer/ });
    expect(save).toHaveProperty('disabled', true);
    const toggle = screen.getAllByRole('switch')[0];
    if (!toggle) throw new Error('Aucun interrupteur de notification.');
    const before = toggle.getAttribute('aria-checked');
    await user.click(toggle);
    await waitFor(() => { expect(screen.getByRole('button', { name: /Enregistrer/ })).toHaveProperty('disabled', false); });
    await user.click(screen.getByRole('button', { name: /Enregistrer/ }));
    await waitFor(() => { expect(screen.getAllByRole('switch')[0]?.getAttribute('aria-checked')).not.toBe(before); });
    const prefs = (await source.parametres.notifications()) as Record<string, boolean>;
    expect(Object.values(prefs).length).toBeGreaterThan(0);
  });
});

describe('RGPD : workflow', () => {
  it('l’étape suivante est confirmée, avance et se consigne au journal', async () => {
    const { source } = renderWithConsole(<RgpdDetailScreen id="paul-lemoine-effacement" />);
    const user = userEvent.setup();
    const before = await auditTotal(source);
    const detail = rgpdDetailSchema.parse(await source.rgpd.get('paul-lemoine-effacement'));
    const next = detail.nextStep;
    if (!next) throw new Error('Aucune étape à traiter.');
    await user.click(await screen.findByRole('button', { name: next.actionLabel }));
    const dialog = await screen.findByRole('dialog');
    expect(await auditTotal(source)).toBe(before);
    await user.click(within(dialog).getByRole('button', { name: next.actionLabel }));
    await waitFor(() => { expect(screen.queryByRole('dialog')).toBeNull(); });
    await waitFor(async () => { expect(await auditTotal(source)).toBe(before + 1); });
    const after = rgpdDetailSchema.parse(await source.rgpd.get('paul-lemoine-effacement'));
    expect(after.steps.find((step) => step.key === next.key)?.doneOn).not.toBeNull();
  });
});
