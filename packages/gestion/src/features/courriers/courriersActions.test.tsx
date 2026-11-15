import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { expectNoA11yViolations } from '../../../test/axe';
import { FROZEN_NOW, at, norm, renderLot } from '../../../test/lots';
import { CourrierApercuPage } from './CourrierApercuPage';
import { CourrierFormPage } from './CourrierFormPage';
import { CourriersPage } from './CourriersPage';
import { amountDueError, variableOverrides } from './courrierVariables';
import type { Courrier } from './schemas';

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(FROZEN_NOW);
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const dataRows = (table: HTMLElement) => within(table).getAllByRole('row').slice(1);
const courriersOf = async (source: { courriers: () => Promise<unknown> }) => (await source.courriers()) as Courrier[];
const find = (items: readonly Courrier[], id: string) => items.find((item) => item.id === id);
const menu = async (reference: string, item: string) => {
  await screen.findByRole('table', { name: 'Courriers' });
  await userEvent.click(screen.getByRole('button', { name: `Plus d’actions, ${reference}` }));
  await userEvent.click(await screen.findByRole('menuitem', { name: item }));
};

describe('courriers, date de mise à jour', () => {
  it('reprend la date d’envoi ou de création pour les courriers existants', async () => {
    const { sources } = renderLot(<CourriersPage />);
    const all = await courriersOf(sources.courriers);
    expect(find(all, 'cr-2026-0041')?.updatedOn).toBe('2026-11-08');
    expect(find(all, 'cr-2026-0040')?.updatedOn).toBe('2026-11-12');
  });

  it('affiche la colonne Mis à jour', async () => {
    renderLot(<CourriersPage />);
    const table = await screen.findByRole('table', { name: 'Courriers' });
    expect(within(table).getByRole('columnheader', { name: 'Mis à jour' })).toBeTruthy();
    expect(within(table).queryByRole('columnheader', { name: 'Créé le' })).toBeNull();
    expect(at(within(at(dataRows(table), 1)).getAllByRole('cell'), 4).textContent).toBe('12/11/2026');
  });

  it('est mise à jour à chaque modification, envoi, renvoi et archivage', async () => {
    const { sources } = renderLot(<CourriersPage />);
    const input = { templateId: '', tenantId: 'clarisse-hounkpatin', unitId: 'apt-b1', channel: 'email', subject: 'Relance modifiée', body: 'Bonjour, merci de régulariser.' };
    await sources.courriers.updateCourrier('cr-2026-0040', input);
    expect(find(await courriersOf(sources.courriers), 'cr-2026-0040')?.updatedOn).toBe('2026-11-13');
    await sources.courriers.markCourrierSent('cr-2026-0035');
    expect(find(await courriersOf(sources.courriers), 'cr-2026-0035')?.updatedOn).toBe('2026-11-13');
    await sources.courriers.resendCourrier('cr-2026-0029');
    expect(find(await courriersOf(sources.courriers), 'cr-2026-0029')?.updatedOn).toBe('2026-11-13');
    await sources.courriers.setCourrierArchived('cr-2026-0038', true);
    expect(find(await courriersOf(sources.courriers), 'cr-2026-0038')?.updatedOn).toBe('2026-11-13');
  });
});

describe('CourriersPage, Renvoyer', () => {
  it('renvoie un courrier envoyé après confirmation : nouvel envoi daté et historisé', async () => {
    const { sources } = renderLot(<CourriersPage />);
    await menu('CR-2026-0041', 'Renvoyer');
    const dialog = await screen.findByRole('dialog');
    expect(norm(dialog.textContent)).toContain('Koffi Adjovi');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Renvoyer le courrier' }));
    await waitFor(async () => { expect(find(await courriersOf(sources.courriers), 'cr-2026-0041')?.sendings).toHaveLength(2); });
    const sent = find(await courriersOf(sources.courriers), 'cr-2026-0041');
    expect(sent).toMatchObject({ status: 'envoye', sentOn: '2026-11-13', updatedOn: '2026-11-13' });
    expect(sent?.sendings).toEqual([{ on: '2026-11-08', channel: 'email', resend: false }, { on: '2026-11-13', channel: 'email', resend: true }]);
  });

  it('désactive Renvoyer sur un brouillon et le refuse côté source', async () => {
    const { sources } = renderLot(<CourriersPage />);
    await screen.findByRole('table', { name: 'Courriers' });
    await userEvent.click(screen.getByRole('button', { name: 'Plus d’actions, CR-2026-0040' }));
    expect((await screen.findByRole('menuitem', { name: 'Renvoyer' })).getAttribute('aria-disabled')).toBe('true');
    await expect(sources.courriers.resendCourrier('cr-2026-0040')).rejects.toThrow('Seul un courrier envoyé peut être renvoyé.');
    await expect(sources.courriers.resendCourrier('inconnu')).rejects.toThrow();
  });

  it('affiche l’historique des envois sur l’aperçu et permet de renvoyer', async () => {
    const { container } = renderLot(<CourrierApercuPage id="cr-2026-0041" />);
    const history = await screen.findByRole('region', { name: 'Historique des envois' });
    expect(norm(history.textContent)).toContain('Envoi du 08/11/2026');
    await userEvent.click(screen.getByRole('button', { name: 'Renvoyer' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Renvoyer le courrier' }));
    expect(await within(await screen.findByRole('region', { name: 'Historique des envois' })).findByText('Renvoi du 13/11/2026')).toBeTruthy();
    await expectNoA11yViolations(container);
  });
});

describe('CourriersPage, Archiver', () => {
  it('archive un courrier sans le supprimer, le retrouve dans Archivés et le désarchive', async () => {
    const { sources } = renderLot(<CourriersPage />);
    await menu('CR-2026-0040', 'Archiver');
    await waitFor(() => { expect(screen.getByRole('tab', { name: /Archivés/ }).textContent).toContain('1'); });
    expect(dataRows(screen.getByRole('table', { name: 'Courriers' }))).toHaveLength(4);
    expect(screen.getByRole('tab', { name: /Brouillons/ }).textContent).toContain('0');
    expect(find(await courriersOf(sources.courriers), 'cr-2026-0040')).toMatchObject({ archived: true, status: 'brouillon' });
    expect(await courriersOf(sources.courriers)).toHaveLength(5);
    await userEvent.click(screen.getByRole('tab', { name: /Archivés/ }));
    const rows = dataRows(screen.getByRole('table', { name: 'Courriers' }));
    expect(rows).toHaveLength(1);
    await userEvent.click(within(at(rows, 0)).getByRole('button', { name: 'Plus d’actions, CR-2026-0040' }));
    expect((await screen.findByRole('menuitem', { name: 'Modifier' })).getAttribute('aria-disabled')).toBe('true');
    await userEvent.click(screen.getByRole('menuitem', { name: 'Désarchiver' }));
    await waitFor(() => { expect(screen.getByRole('tab', { name: /Archivés/ }).textContent).toContain('0'); });
    expect(find(await courriersOf(sources.courriers), 'cr-2026-0040')?.archived).toBe(false);
  });

  it('refuse côté source d’envoyer, renvoyer ou modifier un courrier archivé et un double archivage', async () => {
    const { sources } = renderLot(<CourriersPage />);
    await sources.courriers.setCourrierArchived('cr-2026-0035', true);
    await sources.courriers.setCourrierArchived('cr-2026-0041', true);
    await expect(sources.courriers.setCourrierArchived('cr-2026-0035', true)).rejects.toThrow('Ce courrier est déjà archivé.');
    await expect(sources.courriers.markCourrierSent('cr-2026-0035')).rejects.toThrow('Un courrier archivé ne peut pas être envoyé.');
    await expect(sources.courriers.resendCourrier('cr-2026-0041')).rejects.toThrow('Un courrier archivé ne peut pas être renvoyé.');
    await expect(sources.courriers.updateCourrier('cr-2026-0035', { templateId: '', tenantId: 'yann-le-gall', unitId: '', channel: 'email', subject: 'x', body: 'Bonjour, ceci est un test.' })).rejects.toThrow('Un courrier archivé ne peut plus être modifié.');
  });
});

describe('variables Montant dû et Date limite', () => {
  const route = { search: 'modele=relance-de-loyer-impaye&locataire=koffi-adjovi' };
  const message = () => screen.getByLabelText<HTMLTextAreaElement>('Message *');
  const text = () => norm(message().value);

  it('valide et formate le montant et la date', () => {
    expect(amountDueError('850')).toBeUndefined();
    expect(amountDueError('850,50')).toBeUndefined();
    expect(amountDueError('')).toBeUndefined();
    expect(amountDueError('85a')).toBe('Montant invalide, ex. 850 ou 850,50');
    expect(amountDueError('1,234')).toBe('Montant invalide, ex. 850 ou 850,50');
    const overrides = variableOverrides({ amountDue: '850,50', dueDate: '2026-11-20' });
    expect(norm(overrides.montant_impaye)).toBe('850,50 €');
    expect(overrides.date_limite).toBe('20/11/2026');
    expect(variableOverrides({ amountDue: 'abc', dueDate: '' })).toEqual({});
  });

  it('préremplit le montant dû du bail et la date limite, appliqués au message', async () => {
    const { container } = renderLot(<CourrierFormPage />, route);
    await screen.findByDisplayValue('Relance, loyer de Novembre 2026 impayé');
    expect(screen.getByLabelText<HTMLInputElement>('Montant dû, €').value).toBe('850');
    expect(screen.getByLabelText<HTMLInputElement>('Date limite de paiement').value).toBe('2026-11-20');
    expect(text()).toContain('soit 850 €');
    expect(text()).toContain('avant le 20/11/2026');
    await expectNoA11yViolations(container);
  });

  it('applique un nouveau montant et une nouvelle date tant que le message n’a pas été modifié', async () => {
    renderLot(<CourrierFormPage />, route);
    await screen.findByDisplayValue('Relance, loyer de Novembre 2026 impayé');
    const amount = screen.getByLabelText('Montant dû, €');
    await userEvent.clear(amount);
    await userEvent.type(amount, '900,50');
    expect(text()).toContain('soit 900,50 €');
    await userEvent.clear(screen.getByLabelText('Date limite de paiement'));
    await userEvent.type(screen.getByLabelText('Date limite de paiement'), '2026-12-05');
    expect(text()).toContain('avant le 05/12/2026');
    expect(screen.queryByRole('button', { name: 'Réinsérer les variables' })).toBeNull();
  });

  it('n’écrase pas un message modifié à la main et propose de réinsérer les variables', async () => {
    renderLot(<CourrierFormPage />, route);
    await screen.findByDisplayValue('Relance, loyer de Novembre 2026 impayé');
    await userEvent.type(message(), '\n\nPS : merci de répondre.');
    const edited = message().value;
    const amount = screen.getByLabelText('Montant dû, €');
    await userEvent.clear(amount);
    await userEvent.type(amount, '900');
    expect(message().value).toBe(edited);
    expect(screen.getByText('Message modifié à la main')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Réinsérer les variables' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Réinsérer les variables' }));
    await waitFor(() => { expect(text()).toContain('soit 900 €'); });
    expect(text()).not.toContain('PS : merci de répondre.');
    expect(screen.queryByText('Message modifié à la main')).toBeNull();
  });

  it('signale un montant invalide sans toucher au message', async () => {
    renderLot(<CourrierFormPage />, route);
    await screen.findByDisplayValue('Relance, loyer de Novembre 2026 impayé');
    await userEvent.type(screen.getByLabelText('Montant dû, €'), 'x');
    expect(await screen.findByText('Montant invalide, ex. 850 ou 850,50')).toBeTruthy();
    expect(text()).toContain('soit 850 €');
  });
});
