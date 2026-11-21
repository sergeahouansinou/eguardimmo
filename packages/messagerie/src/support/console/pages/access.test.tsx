import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '@eguardimmo/api';
import { expectNoA11yViolations } from '../../../../test/axe';
import { fakeConsoleSource, renderConsoleSupport } from '../../../../test/console';
import { toDetail } from '../api/mapping';
import { EMERGENCY_WARNINGS } from '../copy';
import {
  GRANT_ID,
  OPERATOR_ID,
  ORGANIZATION_ID,
  OTHER_OPERATOR_ID,
  SECOND_GRANT_ID,
  TICKET_ID,
  accessRequiredProblem,
  consoleDetailResponse,
  consoleGrantFixture,
  consoleTicketFixture,
  requesterMessageFixture,
} from '../testing';
import type { ConsoleGrantFixture, ConsoleTicketFixture } from '../testing';
import { ConsoleSupportTicketPage } from './TicketPage';

const FUTURE = '2099-01-01T10:00:00+00:00';
const PAST = '2020-01-01T10:00:00+00:00';
const READ = { support_last_read_at: '2099-01-01T00:00:00+00:00' };

const withGrants = (grants: ConsoleGrantFixture[], ticket: Partial<ConsoleTicketFixture> = {}) =>
  fakeConsoleSource({ getTicket: () => Promise.resolve(toDetail(consoleDetailResponse(consoleTicketFixture({ ...READ, ...ticket }), [requesterMessageFixture()], grants).data)) });

const panel = async () => screen.findByRole('region', { name: 'Accès aux données de l’organisation' });

describe('panneau « Accès aux données de l’organisation »', () => {
  it('affiche la mention de confidentialité et l’état « aucun accès » sans erreur', async () => {
    const { container } = renderConsoleSupport(<ConsoleSupportTicketPage ticketId={TICKET_ID} />, { source: withGrants([]) });
    const region = await panel();
    expect(within(region).getByText(/Les conversations des utilisateurs ne sont jamais lisibles/)).toBeTruthy();
    expect(within(region).getByText('Aucun accès n’a été demandé pour cette demande.')).toBeTruthy();
    await expectNoA11yViolations(container);
  });

  it.each([
    [{ status: 'requested' }, 'En attente de l’organisation', /Demandé le/],
    [{ status: 'active', expires_at: FUTURE, read_count: 3 }, 'Accordé', /Accordé jusqu’au[\s\S]*/],
    [{ status: 'refused', decided_at: '2026-11-19T11:00:00+00:00' }, 'Refusé par l’organisation', /Refusé le/],
    [{ status: 'revoked', revoked_at: '2026-11-19T11:00:00+00:00' }, 'Révoqué', /Révoqué le/],
    [{ status: 'active', expires_at: PAST }, 'Expiré', /Expiré le/],
    [{ status: 'expired', expires_at: PAST }, 'Expiré', /Expiré le/],
  ] as const)('montre l’état %j', async (overrides, label, timeline) => {
    renderConsoleSupport(<ConsoleSupportTicketPage ticketId={TICKET_ID} />, { source: withGrants([consoleGrantFixture({ ...overrides })]) });
    const region = await panel();
    const item = await within(region).findByRole('article', { name: /Accès avec consentement|Consentement|de Camille Martin/ });
    expect(within(item).getByText(label)).toBeTruthy();
    expect(within(item).getByText(timeline)).toBeTruthy();
  });

  it('compte les lectures d’un accès accordé, au singulier et au pluriel', async () => {
    renderConsoleSupport(<ConsoleSupportTicketPage ticketId={TICKET_ID} />, {
      source: withGrants([consoleGrantFixture({ status: 'active', expires_at: FUTURE, read_count: 3 }), consoleGrantFixture({ id: SECOND_GRANT_ID, status: 'revoked', revoked_at: PAST, read_count: 1 })]),
    });
    expect(await screen.findByText('3 lectures')).toBeTruthy();
    expect(screen.getByText('1 lecture')).toBeTruthy();
  });

  it('demande un accès : défauts 24 h, équipe et réglages, puis envoi', async () => {
    const source = withGrants([]);
    renderConsoleSupport(<ConsoleSupportTicketPage ticketId={TICKET_ID} />, { source });
    await userEvent.click(await screen.findByRole('button', { name: 'Demander l’accès' }));
    const dialog = await screen.findByRole('dialog', { name: /Demander l’accès aux données/ });
    expect(within(dialog).getByRole<HTMLInputElement>('spinbutton', { name: /Durée/ }).value).toBe('24');
    expect(within(dialog).getByRole<HTMLInputElement>('checkbox', { name: 'Équipe' }).checked).toBe(true);
    expect(within(dialog).getByRole<HTMLInputElement>('checkbox', { name: 'Réglages' }).checked).toBe(true);
    expect(within(dialog).getByRole<HTMLInputElement>('checkbox', { name: 'Dossiers' }).checked).toBe(false);
    await userEvent.type(within(dialog).getByRole('textbox', { name: /Motif/ }), 'Diagnostiquer l’erreur d’invitation');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Envoyer la demande' }));
    await waitFor(() => { expect(source.requestAccess).toHaveBeenCalledWith(TICKET_ID, { reason: 'Diagnostiquer l’erreur d’invitation', scopes: ['settings', 'team'], durationHours: 24 }); });
    await waitFor(() => { expect(screen.queryByRole('dialog')).toBeNull(); });
  });

  it.each([
    ['motif trop court', async (dialog: HTMLElement) => { await userEvent.type(within(dialog).getByRole('textbox', { name: /Motif/ }), 'court'); }, /de 10 à 500 caractères/],
    ['aucun périmètre', async (dialog: HTMLElement) => {
      await userEvent.type(within(dialog).getByRole('textbox', { name: /Motif/ }), 'Un motif suffisamment long');
      await userEvent.click(within(dialog).getByRole('checkbox', { name: 'Équipe' }));
      await userEvent.click(within(dialog).getByRole('checkbox', { name: 'Réglages' }));
    }, /au moins un périmètre/],
    ['durée de 73 h', async (dialog: HTMLElement) => {
      await userEvent.type(within(dialog).getByRole('textbox', { name: /Motif/ }), 'Un motif suffisamment long');
      const hours = within(dialog).getByRole('spinbutton', { name: /Durée/ });
      await userEvent.clear(hours);
      await userEvent.type(hours, '73');
    }, /de 1 à 72 heures/],
    ['durée de 0 h', async (dialog: HTMLElement) => {
      await userEvent.type(within(dialog).getByRole('textbox', { name: /Motif/ }), 'Un motif suffisamment long');
      const hours = within(dialog).getByRole('spinbutton', { name: /Durée/ });
      await userEvent.clear(hours);
      await userEvent.type(hours, '0');
    }, /de 1 à 72 heures/],
  ])('refuse la demande : %s', async (_name, fill, message) => {
    const source = withGrants([]);
    renderConsoleSupport(<ConsoleSupportTicketPage ticketId={TICKET_ID} />, { source });
    await userEvent.click(await screen.findByRole('button', { name: 'Demander l’accès' }));
    const dialog = await screen.findByRole('dialog');
    await fill(dialog);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Envoyer la demande' }));
    expect(await within(dialog).findByText(message)).toBeTruthy();
    expect(source.requestAccess).not.toHaveBeenCalled();
  });

  it('traduit le refus d’une seconde demande et rafraîchit la demande', async () => {
    const requestAccess = vi.fn().mockRejectedValue(new ApiError(409, 'support_access_already_open', 'brut'));
    const source = withGrants([]);
    source.requestAccess.mockImplementation(requestAccess);
    renderConsoleSupport(<ConsoleSupportTicketPage ticketId={TICKET_ID} />, { source });
    await userEvent.click(await screen.findByRole('button', { name: 'Demander l’accès' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.type(within(dialog).getByRole('textbox', { name: /Motif/ }), 'Un motif suffisamment long');
    const before = source.getTicket.mock.calls.length;
    await userEvent.click(within(dialog).getByRole('button', { name: 'Envoyer la demande' }));
    expect(await within(dialog).findByText(/déjà demandé ou ouvert/)).toBeTruthy();
    await waitFor(() => { expect(source.getTicket.mock.calls.length).toBeGreaterThan(before); });
  });

  it('désactive les demandes quand un accès est déjà demandé ou que la demande est résolue', async () => {
    const { unmount } = renderConsoleSupport(<ConsoleSupportTicketPage ticketId={TICKET_ID} />, { source: withGrants([consoleGrantFixture({ status: 'requested' })]) });
    const request = await screen.findByRole<HTMLButtonElement>('button', { name: 'Demander l’accès' });
    expect(request.disabled).toBe(true);
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Ouvrir un accès d’urgence' }).disabled).toBe(true);
    expect(screen.getByText('Un accès est déjà demandé ou en cours pour cette demande.')).toBeTruthy();
    unmount();
    renderConsoleSupport(<ConsoleSupportTicketPage ticketId={TICKET_ID} />, { source: withGrants([], { status: 'resolved' }) });
    expect(await screen.findByText(/La demande est résolue/)).toBeTruthy();
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Demander l’accès' }).disabled).toBe(true);
  });

  it('signale une demande sans organisation, sans proposer d’accès', async () => {
    renderConsoleSupport(<ConsoleSupportTicketPage ticketId={TICKET_ID} />, { source: withGrants([], { organization_id: null, organization: null, space: 'tenant' }) });
    expect(await screen.findByText(/n’est rattachée à aucune organisation/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Demander l’accès' })).toBeNull();
  });
});

describe('accès d’urgence', () => {
  const openDialog = async (source = withGrants([])) => {
    renderConsoleSupport(<ConsoleSupportTicketPage ticketId={TICKET_ID} />, { source });
    await userEvent.click(await screen.findByRole('button', { name: 'Ouvrir un accès d’urgence' }));
    return { source, dialog: await screen.findByRole('dialog', { name: 'Ouvrir un accès d’urgence' }) };
  };

  it('affiche tous les avertissements avant l’ouverture', async () => {
    const { dialog } = await openDialog();
    for (const warning of EMERGENCY_WARNINGS) expect(within(dialog).getByText(warning)).toBeTruthy();
    expect(within(dialog).getByText(/prévenue immédiatement/)).toBeTruthy();
    expect(within(dialog).getByText(/1 heure/)).toBeTruthy();
    expect(within(dialog).getAllByText(/second opérateur|autre opérateur/).length).toBeGreaterThan(0);
    expect(within(dialog).getByText(/3 par 24 heures/)).toBeTruthy();
    await expectNoA11yViolations(dialog);
  });

  it('exige motif et confirmation, puis envoie base et motif', async () => {
    const { source, dialog } = await openDialog();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Ouvrir l’accès d’urgence' }));
    expect(await within(dialog).findByText(/de 10 à 500 caractères/)).toBeTruthy();
    await userEvent.type(within(dialog).getByRole('textbox', { name: /Motif/ }), 'Compromission suspectée du compte');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Ouvrir l’accès d’urgence' }));
    expect(await within(dialog).findByText(/Confirmez avoir pris connaissance/)).toBeTruthy();
    expect(source.openEmergency).not.toHaveBeenCalled();
    await userEvent.click(within(dialog).getByRole('radio', { name: /réquisition/i }));
    await userEvent.click(within(dialog).getByRole('checkbox'));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Ouvrir l’accès d’urgence' }));
    await waitFor(() => { expect(source.openEmergency).toHaveBeenCalledWith(TICKET_ID, { reason: 'Compromission suspectée du compte', basis: 'legal_requisition' }); });
  });

  it.each([
    [new ApiError(429, 'support_emergency_cooldown', 'brut', {}, 7200), /délai de suspension[\s\S]*2 h/],
    [new ApiError(429, 'support_emergency_limit', 'brut', {}, 3600), /Réessayez dans 60 min/],
    [new ApiError(409, 'support_emergency_review_pending', 'brut'), /doit l’être/],
    [new ApiError(409, 'support_emergency_organization_busy', 'brut'), /déjà ouvert sur cette organisation/],
  ])('traduit le refus %#', async (error, message) => {
    const source = withGrants([]);
    source.openEmergency.mockRejectedValue(error);
    const { dialog } = await openDialog(source);
    await userEvent.type(within(dialog).getByRole('textbox', { name: /Motif/ }), 'Compromission suspectée du compte');
    await userEvent.click(within(dialog).getByRole('checkbox'));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Ouvrir l’accès d’urgence' }));
    const alert = await within(dialog).findByText(message);
    expect(alert).toBeTruthy();
    expect(within(dialog).queryByText('brut')).toBeNull();
  });
});

describe('revue d’un accès d’urgence par un autre opérateur', () => {
  const emergency = (operator: { id: string; name: string }, overrides: Partial<ConsoleGrantFixture> = {}) =>
    consoleGrantFixture({ kind: 'emergency', status: 'active', emergency_basis: 'security_incident', scopes: ['settings', 'team'], duration_hours: 1, expires_at: FUTURE, operator, ...overrides });

  it('propose la revue à un autre opérateur et la confirme', async () => {
    const source = withGrants([emergency({ id: OTHER_OPERATOR_ID, name: 'Hugo Bernard' })]);
    renderConsoleSupport(<ConsoleSupportTicketPage ticketId={TICKET_ID} />, { source });
    await userEvent.click(await screen.findByRole('button', { name: 'Revoir cet accès d’urgence' }));
    const dialog = await screen.findByRole('alertdialog', { name: /Confirmer la revue/ }).catch(() => screen.findByRole('dialog', { name: /Confirmer la revue/ }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Confirmer la revue' }));
    await waitFor(() => { expect(source.reviewGrant).toHaveBeenCalledWith(GRANT_ID); });
  });

  it('masque la revue à l’auteur de l’accès et dit pourquoi', async () => {
    renderConsoleSupport(<ConsoleSupportTicketPage ticketId={TICKET_ID} />, { source: withGrants([emergency({ id: OPERATOR_ID, name: 'Camille Martin' })]) });
    expect(await screen.findByText(/vous ne pouvez pas revoir votre propre accès d’urgence/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Revoir cet accès d’urgence' })).toBeNull();
    expect(screen.getByText('Revue par un second opérateur en attente.')).toBeTruthy();
  });

  it('n’offre plus la revue d’un accès déjà revu, quand un autre reste à revoir', async () => {
    const pending = emergency({ id: OTHER_OPERATOR_ID, name: 'Hugo Bernard' }, { id: SECOND_GRANT_ID, reason: 'Second accès en attente de revue.' });
    const done = emergency({ id: OTHER_OPERATOR_ID, name: 'Hugo Bernard' }, { reviewed: true, reviewed_at: '2026-11-19T12:00:00+00:00' });
    renderConsoleSupport(<ConsoleSupportTicketPage ticketId={TICKET_ID} />, { source: withGrants([done, pending]) });
    expect(await screen.findAllByRole('button', { name: 'Revoir cet accès d’urgence' })).toHaveLength(1);
    expect(screen.getByText(/Revue par un autre opérateur le/)).toBeTruthy();
  });

  it('traduit le refus du serveur et le montre dans le panneau', async () => {
    const source = withGrants([emergency({ id: OTHER_OPERATOR_ID, name: 'Hugo Bernard' })]);
    source.reviewGrant.mockRejectedValue(new ApiError(403, 'support_access_review_forbidden', 'brut'));
    renderConsoleSupport(<ConsoleSupportTicketPage ticketId={TICKET_ID} />, { source });
    await userEvent.click(await screen.findByRole('button', { name: 'Revoir cet accès d’urgence' }));
    const dialog = await screen.findByRole('alertdialog', { name: /Confirmer la revue/ }).catch(() => screen.findByRole('dialog', { name: /Confirmer la revue/ }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Confirmer la revue' }));
    expect(await screen.findByText(/revient à un autre opérateur/)).toBeTruthy();
  });
});

describe('lectures de l’organisation, gardées par un accès vivant', () => {
  const live = (overrides: Partial<ConsoleGrantFixture> = {}) => consoleGrantFixture({ status: 'active', expires_at: FUTURE, ...overrides });

  it('sans accès vivant : état « accès requis » clair et aucune lecture lancée', async () => {
    const source = withGrants([]);
    renderConsoleSupport(<ConsoleSupportTicketPage ticketId={TICKET_ID} />, { source });
    const region = await panel();
    expect(within(await within(region).findByRole('region', { name: 'Équipe de l’organisation' })).getByText(/Accès requis/)).toBeTruthy();
    expect(within(within(region).getByRole('region', { name: 'Réglages de l’organisation' })).getByText(/Accès requis/)).toBeTruthy();
    expect(source.organizationTeam).not.toHaveBeenCalled();
    expect(source.organizationSettings).not.toHaveBeenCalled();
  });

  it('un accès expiré ou d’un autre opérateur n’ouvre aucune lecture', async () => {
    const source = withGrants([live({ expires_at: PAST }), live({ id: SECOND_GRANT_ID, operator: { id: OTHER_OPERATOR_ID, name: 'Hugo Bernard' } })]);
    renderConsoleSupport(<ConsoleSupportTicketPage ticketId={TICKET_ID} />, { source });
    await panel();
    expect(screen.queryByRole('button', { name: 'Consulter l’équipe' })).toBeNull();
    expect(screen.getAllByText(/Accès requis/).length).toBe(2);
  });

  it('avec un accès vivant : lecture à la demande de l’équipe puis des réglages', async () => {
    const source = withGrants([live()]);
    renderConsoleSupport(<ConsoleSupportTicketPage ticketId={TICKET_ID} />, { source });
    await panel();
    expect(source.organizationTeam).not.toHaveBeenCalled();
    await userEvent.click(await screen.findByRole('button', { name: 'Consulter l’équipe' }));
    const members = await screen.findByRole('list', { name: 'Membres de l’équipe' });
    expect(within(members).getByText('Awa Koffi')).toBeTruthy();
    expect(within(members).getByText('Propriétaire')).toBeTruthy();
    expect(source.organizationTeam).toHaveBeenCalledWith(ORGANIZATION_ID);
    await userEvent.click(screen.getByRole('button', { name: 'Consulter les réglages' }));
    expect(await screen.findByText('Agence des Tilleuls', { selector: 'dd' })).toBeTruthy();
    expect(source.organizationSettings).toHaveBeenCalledWith(ORGANIZATION_ID);
  });

  it('un accès limité aux réglages dit que l’équipe n’est pas couverte', async () => {
    renderConsoleSupport(<ConsoleSupportTicketPage ticketId={TICKET_ID} />, { source: withGrants([live({ scopes: ['settings'] })]) });
    expect(await screen.findByText(/ne couvre pas le périmètre « Équipe »/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Consulter les réglages' })).toBeTruthy();
  });

  it('un 403 support_access_required du serveur devient un état clair, jamais une erreur brute', async () => {
    const source = withGrants([live()]);
    source.organizationTeam.mockRejectedValue(new ApiError(403, accessRequiredProblem.code, accessRequiredProblem.detail));
    renderConsoleSupport(<ConsoleSupportTicketPage ticketId={TICKET_ID} />, { source });
    await userEvent.click(await screen.findByRole('button', { name: 'Consulter l’équipe' }));
    const block = await screen.findByRole('region', { name: 'Équipe de l’organisation' });
    expect(await within(block).findByText(/Accès requis/)).toBeTruthy();
    expect(within(block).queryByText(accessRequiredProblem.detail)).toBeNull();
    expect(within(block).queryByRole('button', { name: /Réessayer/ })).toBeNull();
  });

  it('traduit une autre panne de lecture et permet de réessayer', async () => {
    const source = withGrants([live()]);
    source.organizationSettings.mockRejectedValueOnce(new ApiError(503, 'unavailable', 'brut'));
    renderConsoleSupport(<ConsoleSupportTicketPage ticketId={TICKET_ID} />, { source });
    await userEvent.click(await screen.findByRole('button', { name: 'Consulter les réglages' }));
    const block = await screen.findByRole('region', { name: 'Réglages de l’organisation' });
    expect(await within(block).findByText(/momentanément indisponible/)).toBeTruthy();
    await userEvent.click(within(block).getByRole('button', { name: /Réessayer/ }));
    expect(await within(block).findByText('EUR')).toBeTruthy();
  });

  it('n’expose aucune route de lecture des dossiers ni des documents', async () => {
    renderConsoleSupport(<ConsoleSupportTicketPage ticketId={TICKET_ID} />, { source: withGrants([live({ scopes: ['settings', 'team', 'records', 'documents'] })]) });
    await panel();
    expect(screen.queryByRole('button', { name: /dossiers|documents/i })).toBeNull();
  });
});
