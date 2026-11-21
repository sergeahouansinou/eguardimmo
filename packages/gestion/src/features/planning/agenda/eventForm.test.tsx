import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { expectNoA11yViolations } from '../../../../test/axe';
import { OrgApiError } from '../../orgapi/errors';
import { TEST_COLLEAGUE, TEST_PROPERTY, TEST_UNIT, TEST_USER, orgInfoStub } from '../../orgapi/testing';
import type { EventInput } from '../model';
import { PlanningEventFormPage } from './PlanningEventFormPage';
import { TEST_EVENT, planningEvent, planningStub, renderAgenda } from './testing';

const nominal: EventInput = {
  kind: 'appointment',
  title: 'Rendez-vous syndic',
  notes: '',
  startsOn: '2026-11-21',
  startTime: '09:00',
  recurrence: 'none',
  recurrenceUntil: '',
  reminderOffsetMinutes: null,
  propertyId: '',
  unitId: '',
  leaseId: '',
  attendees: [],
};

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-21T10:00:00Z'));
});

afterEach(() => {
  vi.useRealTimers();
});

const title = () => screen.findByLabelText('Titre *');

async function fillTitle(user: ReturnType<typeof userEvent.setup>, value = nominal.title) {
  await user.type(await title(), value);
}

describe('formulaire d’événement', () => {
  it('crée un événement avec la date proposée par l’agenda puis ouvre sa fiche', async () => {
    const user = userEvent.setup();
    const source = planningStub();
    const { push, container } = renderAgenda(<PlanningEventFormPage />, source, { search: 'date=2026-12-03' });
    await fillTitle(user);
    await expectNoA11yViolations(container);
    await user.click(screen.getByRole('button', { name: 'Créer l’événement' }));
    await waitFor(() => { expect(push).toHaveBeenCalledWith(`/agenda/${TEST_EVENT}`); });
    expect(source.createEvent).toHaveBeenCalledWith({ ...nominal, startsOn: '2026-12-03' });
  });

  it('envoie une série hebdomadaire sur la journée avec rappel, liens et participants', async () => {
    const user = userEvent.setup();
    const source = planningStub();
    renderAgenda(<PlanningEventFormPage />, source);
    await fillTitle(user, 'Contrôle chaudière');
    await user.click(screen.getByLabelText('Toute la journée'));
    await user.click(screen.getByRole('combobox', { name: /Récurrence/ }));
    await user.click(await screen.findByRole('option', { name: 'Chaque semaine' }));
    fireEvent.change(await screen.findByLabelText('Répéter jusqu’au'), { target: { value: '2027-03-01' } });
    await user.click(screen.getByRole('combobox', { name: /Rappel/ }));
    await user.click(await screen.findByRole('option', { name: '1 jour avant' }));
    await user.click(screen.getByRole('combobox', { name: /Bien/ }));
    await user.click(await screen.findByRole('option', { name: 'Résidence des Lilas' }));
    await user.click(screen.getByRole('combobox', { name: /Lot/ }));
    await user.click(await screen.findByRole('option', { name: 'Apt 12' }));
    await user.click(await screen.findByRole('button', { name: 'Ajouter Alex Dupont' }));
    await user.click(screen.getByRole('button', { name: 'Créer l’événement' }));
    await waitFor(() => { expect(source.createEvent).toHaveBeenCalled(); });
    expect(source.createEvent).toHaveBeenCalledWith({
      ...nominal,
      title: 'Contrôle chaudière',
      startTime: '',
      recurrence: 'weekly',
      recurrenceUntil: '2027-03-01',
      reminderOffsetMinutes: 1440,
      propertyId: TEST_PROPERTY,
      unitId: TEST_UNIT,
      attendees: [{ userId: TEST_COLLEAGUE, partyId: null }],
    });
  });

  it('refuse un formulaire invalide sans appeler le serveur', async () => {
    const user = userEvent.setup();
    const source = planningStub();
    renderAgenda(<PlanningEventFormPage />, source);
    await title();
    await user.click(screen.getByRole('button', { name: 'Créer l’événement' }));
    expect(await screen.findByText('Indiquez un titre.')).toBeTruthy();
    await user.type(screen.getByLabelText('Titre *'), 'Visite <b>');
    expect(await screen.findByText(/ne peut pas contenir/)).toBeTruthy();
    expect(source.createEvent).not.toHaveBeenCalled();
  });

  it('contrôle l’heure, la fin de série et le lot sans bien', async () => {
    const user = userEvent.setup();
    const source = planningStub();
    renderAgenda(<PlanningEventFormPage />, source);
    await fillTitle(user);
    fireEvent.change(screen.getByLabelText(/Heure/), { target: { value: '' } });
    await user.click(screen.getByRole('combobox', { name: /Récurrence/ }));
    await user.click(await screen.findByRole('option', { name: 'Chaque mois' }));
    fireEvent.change(await screen.findByLabelText('Répéter jusqu’au'), { target: { value: '2026-01-01' } });
    await user.click(screen.getByRole('button', { name: 'Créer l’événement' }));
    expect(await screen.findByText(/Indiquez une heure valide/)).toBeTruthy();
    expect(screen.getByText('La fin de la récurrence précède le début de l’événement.')).toBeTruthy();
    expect(source.createEvent).not.toHaveBeenCalled();
  });

  it('affiche l’erreur serveur du plafond de séries et rattache les erreurs de champ', async () => {
    const user = userEvent.setup();
    const createEvent = vi
      .fn()
      .mockRejectedValueOnce(new OrgApiError('invalid', 'Le nombre de séries récurrentes actives de l’organisation est atteint.', { status: 422, code: 'planning_series_limit_reached' }))
      .mockRejectedValueOnce(new OrgApiError('invalid', 'Lien invalide', { status: 422, code: 'validation_failed', fieldErrors: { title: ['Titre refusé par le serveur.'] } }));
    renderAgenda(<PlanningEventFormPage />, planningStub({ createEvent }));
    await fillTitle(user);
    await user.click(screen.getByRole('button', { name: 'Créer l’événement' }));
    expect(await screen.findByText(/séries récurrentes actives/)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Créer l’événement' }));
    expect(await screen.findByText('Titre refusé par le serveur.')).toBeTruthy();
  });

  it('préremplit la modification et envoie la version lue', async () => {
    const user = userEvent.setup();
    const source = planningStub();
    const { push } = renderAgenda(<PlanningEventFormPage id={TEST_EVENT} />, source);
    const field = await screen.findByLabelText('Titre *');
    expect((field as HTMLInputElement).value).toBe('Visite appartement 12');
    expect(screen.getByLabelText<HTMLTextAreaElement>('Notes').value).toBe('Apporter les clés.');
    await user.clear(field);
    await user.type(field, 'Visite reportée');
    await user.click(screen.getByRole('button', { name: 'Enregistrer les modifications' }));
    await waitFor(() => { expect(push).toHaveBeenCalledWith(`/agenda/${TEST_EVENT}`); });
    expect(source.updateEvent).toHaveBeenCalledWith(TEST_EVENT, 3, expect.objectContaining({ title: 'Visite reportée', startTime: '14:00', reminderOffsetMinutes: 60, attendees: [{ userId: TEST_USER, partyId: null }] }));
  });

  it('bloque l’enregistrement après un conflit de version jusqu’au rechargement', async () => {
    const user = userEvent.setup();
    const event = vi.fn().mockResolvedValueOnce(planningEvent()).mockResolvedValue(planningEvent({ title: 'Titre modifié ailleurs', lockVersion: 4 }));
    const updateEvent = vi.fn().mockRejectedValue(new OrgApiError('stale', 'L’élément a été modifié depuis sa lecture.', { status: 409, code: 'planning_version_conflict' }));
    renderAgenda(<PlanningEventFormPage id={TEST_EVENT} />, planningStub({ event, updateEvent }));
    const field = await screen.findByLabelText('Titre *');
    await user.type(field, ' bis');
    await user.click(screen.getByRole('button', { name: 'Enregistrer les modifications' }));
    expect(await screen.findByText('Événement modifié entre-temps')).toBeTruthy();
    const save = screen.getByRole('button', { name: 'Enregistrer les modifications' });
    expect((save as HTMLButtonElement).disabled).toBe(true);
    await user.click(screen.getByRole('button', { name: 'Recharger l’événement' }));
    await waitFor(() => { expect(screen.getByLabelText<HTMLInputElement>('Titre *').value).toBe('Titre modifié ailleurs'); });
    expect(screen.queryByText('Événement modifié entre-temps')).toBeNull();
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Enregistrer les modifications' }).disabled).toBe(false);
  });

  it('refuse la modification d’un événement annulé et d’un événement introuvable', async () => {
    const cancelled = renderAgenda(<PlanningEventFormPage id={TEST_EVENT} />, planningStub({ event: vi.fn(() => Promise.resolve(planningEvent({ cancelledAt: '2026-11-02T10:00:00Z' }))) }));
    expect(await screen.findByText('Événement annulé')).toBeTruthy();
    cancelled.unmount();
    renderAgenda(<PlanningEventFormPage id={TEST_EVENT} />, planningStub({ event: vi.fn(() => Promise.reject(new OrgApiError('not_found', 'Introuvable', { status: 404, code: 'planning_event_not_found' }))) }));
    expect(await screen.findByText('Événement introuvable')).toBeTruthy();
  });

  it('refuse l’accès à un rôle en lecture seule', async () => {
    renderAgenda(<PlanningEventFormPage />, planningStub(), { info: orgInfoStub({ role: 'accountant' }) });
    expect(await screen.findByText('Accès refusé')).toBeTruthy();
    expect(screen.queryByLabelText('Titre *')).toBeNull();
  });

  it('réinitialise le lot quand le bien change et plafonne les participants', async () => {
    const user = userEvent.setup();
    renderAgenda(<PlanningEventFormPage id={TEST_EVENT} />, planningStub({ event: vi.fn(() => Promise.resolve(planningEvent({ attendees: Array.from({ length: 20 }, (_, index) => ({ userId: null, partyId: `0198a0a0-0000-7000-8000-00000000${String(index).padStart(4, '0')}` })) }))) }));
    await screen.findByLabelText('Titre *');
    expect(screen.getByText(/Le nombre maximal de participants est atteint/)).toBeTruthy();
    expect(screen.queryByLabelText('Ajouter un contact')).toBeNull();
    await user.click(screen.getByRole('combobox', { name: /Bien/ }));
    await user.click(await screen.findByRole('option', { name: 'Aucun bien' }));
    await waitFor(() => { expect(screen.getByRole<HTMLButtonElement>('combobox', { name: /Lot/ }).disabled).toBe(true); });
    expect(screen.getByRole('combobox', { name: /Lot/ }).textContent).toContain('Aucun lot');
  });
});
