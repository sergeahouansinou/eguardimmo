import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { expectNoA11yViolations } from '../../../../test/axe';
import * as api from '../api/fixtures';
import { PlanningTaskDetailPage } from './PlanningTaskDetailPage';
import { planningUrl, problem, renderTasks } from './testing';

const SLOW = { timeout: 4000 };
const showUrl = (id: string) => planningUrl(`/tasks/${id}`);
const showRoute = <T extends { id: string }>(task: T) => ({ [`GET ${showUrl(task.id)}`]: { body: { data: task } } });
const missingRoute = { [`GET ${showUrl(api.IDS.task)}`]: problem(404, 'planning_task_not_found') };
const action = (id: string, name: string) => planningUrl(`/tasks/${id}/${name}`);

describe('fiche d’une tâche', () => {
  it('affiche l’échéance, le responsable, le rappel et des liens valides', async () => {
    const task = { ...api.task, unit_id: api.IDS.unit, lease_id: api.IDS.lease };
    renderTasks(<PlanningTaskDetailPage id={api.IDS.task} />, { ...showRoute(task), [`GET ${planningUrl('/events')}`]: { body: { data: [] } } });

    expect(await screen.findByRole('heading', { name: /Relancer le syndic/ }, SLOW)).toBeTruthy();
    expect(screen.getByText('En retard')).toBeTruthy();
    expect(screen.getByText('20/03/2026')).toBeTruthy();
    expect(screen.getByText('3 jours avant')).toBeTruthy();
    expect(await screen.findByText('Alex Dupont')).toBeTruthy();
    expect((await screen.findByRole('link', { name: 'Résidence des Lilas' })).getAttribute('href')).toBe(`/biens/immeubles/${api.IDS.property}`);
    expect((await screen.findByRole('link', { name: 'Apt 12' })).getAttribute('href')).toBe(`/biens/${api.IDS.unit}`);
    expect((await screen.findByRole('link', { name: 'BAIL-2026-001' })).getAttribute('href')).toBe(`/baux/${api.IDS.lease}`);
    expect(screen.getByRole('link', { name: /Modifier/ }).getAttribute('href')).toBe(`/taches/${api.IDS.task}/modifier`);
  });

  it('n’a aucune violation d’accessibilité', async () => {
    const { container } = renderTasks(<PlanningTaskDetailPage id={api.IDS.task} />, showRoute(api.task));
    await screen.findByRole('heading', { name: /Relancer le syndic/ }, SLOW);

    await expectNoA11yViolations(container);
  });

  it('termine la tâche', async () => {
    const { callsTo } = renderTasks(<PlanningTaskDetailPage id={api.IDS.task} />, { ...showRoute(api.task), [`POST ${action(api.IDS.task, 'complete')}`]: { body: { data: { ...api.task, status: 'done' } } } });

    await userEvent.click(await screen.findByRole('button', { name: 'Terminer' }, SLOW));

    await waitFor(() => { expect(callsTo('POST', action(api.IDS.task, 'complete'))).toHaveLength(1); });
  });

  it('demande confirmation avant d’annuler et n’appelle rien si on renonce', async () => {
    const { callsTo } = renderTasks(<PlanningTaskDetailPage id={api.IDS.task} />, { ...showRoute(api.task), [`POST ${action(api.IDS.task, 'cancel')}`]: { body: { data: { ...api.task, status: 'cancelled' } } } });

    await userEvent.click(await screen.findByRole('button', { name: 'Annuler la tâche' }, SLOW));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Annuler' }));
    await waitFor(() => { expect(screen.queryByRole('dialog')).toBeNull(); });
    expect(callsTo('POST', action(api.IDS.task, 'cancel'))).toHaveLength(0);

    await userEvent.click(screen.getByRole('button', { name: 'Annuler la tâche' }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Annuler la tâche' }));

    await waitFor(() => { expect(callsTo('POST', action(api.IDS.task, 'cancel'))).toHaveLength(1); });
  });

  it('affiche la date de clôture dans le fuseau de l’organisation, sans décalage UTC', async () => {
    renderTasks(<PlanningTaskDetailPage id={api.IDS.taskDone} />, showRoute(api.doneTask), { timezone: 'Asia/Tokyo' });

    expect(await screen.findByText(/19\/03\/2026 à 18:15/, undefined, SLOW)).toBeTruthy();
  });

  it('rouvre une tâche terminée', async () => {
    const { callsTo } = renderTasks(<PlanningTaskDetailPage id={api.IDS.taskDone} />, { ...showRoute(api.doneTask), [`POST ${action(api.IDS.taskDone, 'reopen')}`]: { body: { data: { ...api.doneTask, status: 'open' } } } });

    await userEvent.click(await screen.findByRole('button', { name: 'Rouvrir' }, SLOW));

    await waitFor(() => { expect(callsTo('POST', action(api.IDS.taskDone, 'reopen'))).toHaveLength(1); });
    expect(screen.queryByRole('link', { name: /Modifier/ })).toBeNull();
  });

  it('réserve la réouverture d’une tâche annulée au propriétaire, à l’administrateur et au gestionnaire', async () => {
    renderTasks(<PlanningTaskDetailPage id={api.IDS.taskCancelled} />, showRoute(api.cancelledTask), { role: 'accountant' });

    expect(await screen.findByText(/Seuls le propriétaire, l’administrateur et le gestionnaire/, undefined, SLOW)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Rouvrir' })).toBeNull();
  });

  it('propose la réouverture d’une tâche annulée à un gestionnaire', async () => {
    renderTasks(<PlanningTaskDetailPage id={api.IDS.taskCancelled} />, showRoute(api.cancelledTask), { role: 'manager' });

    expect(await screen.findByRole('button', { name: 'Rouvrir' }, SLOW)).toBeTruthy();
  });

  it('masque modification et annulation à un rôle en lecture', async () => {
    renderTasks(<PlanningTaskDetailPage id={api.IDS.task} />, showRoute(api.task), { role: 'accountant' });

    await screen.findByRole('heading', { name: /Relancer le syndic/ }, SLOW);
    expect(screen.queryByRole('link', { name: /Modifier/ })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Annuler la tâche' })).toBeNull();
  });

  it.each([
    [409, 'planning_task_not_open', /déjà terminée ou annulée/],
    [403, 'role_forbidden', /Votre rôle ne permet pas/],
    [404, 'planning_task_not_found', /n’existe pas dans votre organisation/],
    [429, 'too_many_requests', /Trop de requêtes/],
  ])('affiche l’erreur %i %s de l’action Terminer', async (status, code, message) => {
    renderTasks(<PlanningTaskDetailPage id={api.IDS.task} />, { ...showRoute(api.task), [`POST ${action(api.IDS.task, 'complete')}`]: problem(status, code) });

    await userEvent.click(await screen.findByRole('button', { name: 'Terminer' }, SLOW));

    expect(await screen.findByText(message, undefined, SLOW)).toBeTruthy();
  });

  it('signale une tâche introuvable avec un retour vers la liste', async () => {
    renderTasks(<PlanningTaskDetailPage id={api.IDS.task} />, missingRoute);

    expect(await screen.findByText('Tâche introuvable', undefined, SLOW)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Retour aux tâches' }).getAttribute('href')).toBe('/taches');
  });

  it('affiche un accès refusé sur un 403 de lecture', async () => {
    renderTasks(<PlanningTaskDetailPage id={api.IDS.task} />, { [`GET ${showUrl(api.IDS.task)}`]: problem(403, 'role_forbidden') });

    expect(await screen.findByText('Accès refusé', undefined, SLOW)).toBeTruthy();
  });

  it('propose Réessayer après une panne puis affiche la tâche', async () => {
    let attempts = 0;
    renderTasks(<PlanningTaskDetailPage id={api.IDS.task} />, { [`GET ${showUrl(api.IDS.task)}`]: () => (++attempts === 1 ? problem(500, 'server_error') : { body: { data: api.task } }) });

    await userEvent.click(await screen.findByRole('button', { name: 'Réessayer' }, SLOW));

    expect(await screen.findByRole('heading', { name: /Relancer le syndic/ }, SLOW)).toBeTruthy();
  });
});
