import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { expectNoA11yViolations } from '../../../../test/axe';
import { saveBlob } from '../../finances/rent/download';
import { OrgApiError } from '../../orgapi/errors';
import { TEST_LEASE, TEST_PROPERTY, TEST_UNIT, orgInfoStub } from '../../orgapi/testing';
import { PlanningEventDetailPage } from './PlanningEventDetailPage';
import { TEST_EVENT, infoInZone, planningEvent, planningStub, renderAgenda } from './testing';

vi.mock('../../finances/rent/download', () => ({ saveBlob: vi.fn() }));

const eventSource = (event = planningEvent()) => planningStub({ event: vi.fn(() => Promise.resolve(event)) });

describe('fiche d’événement', () => {
  it('affiche le détail, les liens vers le bien, le lot et le bail, et les notes en texte', async () => {
    const { container } = renderAgenda(<PlanningEventDetailPage id={TEST_EVENT} />, eventSource(planningEvent({ notes: 'Apporter <les> clés & le badge' })));
    expect(await screen.findByRole('heading', { level: 1, name: 'Visite appartement 12' })).toBeTruthy();
    const detail = screen.getByRole('region', { name: 'Détail de l’événement' });
    expect(detail.textContent).toContain('21/11/2026 à 14:00');
    expect(detail.textContent).toContain('Ne se répète pas');
    expect(detail.textContent).toContain('1 heure avant');
    expect(detail.textContent).toContain('Apporter <les> clés & le badge');
    expect(detail.querySelector('les')).toBeNull();
    await waitFor(() => { expect(within(detail).getByRole('link', { name: 'Résidence des Lilas' }).getAttribute('href')).toBe(`/biens/immeubles/${TEST_PROPERTY}`); });
    expect(within(detail).getByRole('link', { name: 'Apt 12' }).getAttribute('href')).toBe(`/biens/${TEST_UNIT}`);
    expect(within(detail).getByRole('link', { name: 'BAIL-2026-001' }).getAttribute('href')).toBe(`/baux/${TEST_LEASE}`);
    expect(await within(detail).findByText('Camille Martin')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Modifier' }).getAttribute('href')).toBe(`/agenda/${TEST_EVENT}/modifier`);
    await expectNoA11yViolations(container);
  });

  it('affiche l’heure dans le fuseau de l’organisation et rappelle l’heure saisie', async () => {
    renderAgenda(<PlanningEventDetailPage id={TEST_EVENT} />, eventSource(), { info: infoInZone('America/Toronto') });
    const detail = await screen.findByRole('region', { name: 'Détail de l’événement' });
    expect(detail.textContent).toContain('21/11/2026 à 08:00');
    expect(detail.textContent).toContain('Saisi à 14:00 (Europe/Paris).');
  });

  it('décrit une série sur la journée', async () => {
    renderAgenda(<PlanningEventDetailPage id={TEST_EVENT} />, eventSource(planningEvent({ allDay: true, startTime: null, timezone: null, recurrence: 'yearly', recurrenceUntil: '2030-11-21', reminderOffsetMinutes: null, attendees: [], notes: null })));
    const detail = await screen.findByRole('region', { name: 'Détail de l’événement' });
    expect(detail.textContent).toContain('Samedi 21 novembre 2026, toute la journée');
    expect(detail.textContent).toContain('Chaque année, jusqu’au Jeudi 21 novembre 2030');
    expect(detail.textContent).toContain('Aucun rappel');
    expect(detail.textContent).toContain('Aucun participant');
  });

  it('exporte l’événement au format .ics', async () => {
    const user = userEvent.setup();
    renderAgenda(<PlanningEventDetailPage id={TEST_EVENT} />, eventSource());
    await user.click(await screen.findByRole('button', { name: 'Ajouter à mon calendrier' }));
    expect(saveBlob).toHaveBeenCalledWith(expect.any(Blob), 'evenement-2026-11-21.ics');
  });

  it('annule après confirmation seulement', async () => {
    const user = userEvent.setup();
    const source = eventSource();
    renderAgenda(<PlanningEventDetailPage id={TEST_EVENT} />, source);
    await user.click(await screen.findByRole('button', { name: 'Annuler l’événement' }));
    const dialog = await screen.findByRole('dialog');
    expect(source.cancelEvent).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole('button', { name: 'Annuler l’événement' }));
    await waitFor(() => { expect(source.cancelEvent).toHaveBeenCalledWith(TEST_EVENT); });
    await waitFor(() => { expect(screen.queryByRole('dialog')).toBeNull(); });
  });

  it('prévient qu’une série entière sera annulée', async () => {
    const user = userEvent.setup();
    renderAgenda(<PlanningEventDetailPage id={TEST_EVENT} />, eventSource(planningEvent({ recurrence: 'weekly' })));
    await user.click(await screen.findByRole('button', { name: 'Annuler l’événement' }));
    expect((await screen.findByRole('dialog')).textContent).toContain('Toute la série disparaîtra');
  });

  it('garde la fenêtre ouverte et explique l’échec quand le serveur refuse l’annulation', async () => {
    const user = userEvent.setup();
    const cancelEvent = vi.fn(() => Promise.reject(new OrgApiError('conflict', 'Un événement annulé ne se modifie plus.', { status: 409, code: 'planning_event_cancelled' })));
    renderAgenda(<PlanningEventDetailPage id={TEST_EVENT} />, { ...eventSource(), cancelEvent });
    await user.click(await screen.findByRole('button', { name: 'Annuler l’événement' }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Annuler l’événement' }));
    expect(await screen.findByText('Un événement annulé ne se modifie plus.')).toBeTruthy();
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('n’offre aucune action sur un événement annulé', async () => {
    renderAgenda(<PlanningEventDetailPage id={TEST_EVENT} />, eventSource(planningEvent({ cancelledAt: '2026-11-02T10:00:00Z' })));
    expect(await screen.findByText(/n’apparaît plus dans l’agenda/)).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Modifier' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Annuler l’événement' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Ajouter à mon calendrier' })).toBeNull();
  });

  it('masque la modification et l’annulation à un rôle en lecture seule', async () => {
    renderAgenda(<PlanningEventDetailPage id={TEST_EVENT} />, eventSource(), { info: orgInfoStub({ role: 'accountant' }) });
    await screen.findByRole('button', { name: 'Ajouter à mon calendrier' });
    expect(screen.queryByRole('link', { name: 'Modifier' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Annuler l’événement' })).toBeNull();
  });

  it('gère un événement introuvable, un refus et une panne avec réessai', async () => {
    const notFound = renderAgenda(<PlanningEventDetailPage id={TEST_EVENT} />, planningStub({ event: vi.fn(() => Promise.reject(new OrgApiError('not_found', 'Introuvable', { status: 404, code: 'planning_event_not_found' }))) }));
    expect(await screen.findByText('Événement introuvable')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Retour à l’agenda' }).getAttribute('href')).toBe('/agenda');
    notFound.unmount();
    const forbidden = renderAgenda(<PlanningEventDetailPage id={TEST_EVENT} />, planningStub({ event: vi.fn(() => Promise.reject(new OrgApiError('forbidden', 'Votre rôle ne permet pas cette action.', { status: 403 }))) }));
    expect(await screen.findByText('Accès refusé')).toBeTruthy();
    forbidden.unmount();
    const user = userEvent.setup();
    const event = vi.fn().mockRejectedValueOnce(new OrgApiError('unavailable', 'Indisponible', { status: 503 })).mockResolvedValue(planningEvent());
    renderAgenda(<PlanningEventDetailPage id={TEST_EVENT} />, planningStub({ event }));
    expect(await screen.findByText(/Impossible de charger l’événement/)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Réessayer' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Visite appartement 12' })).toBeTruthy();
  });
});
