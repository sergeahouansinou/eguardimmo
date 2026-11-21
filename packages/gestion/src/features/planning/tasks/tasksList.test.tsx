import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { expectNoA11yViolations } from '../../../../test/axe';
import * as api from '../api/fixtures';
import { PlanningTasksPage } from './PlanningTasksPage';
import { planningUrl, problem, renderTasks } from './testing';

const SLOW = { timeout: 4000 };
const listUrl = planningUrl('/tasks');
const route = (...tasks: unknown[]) => ({ [`GET ${listUrl}`]: { body: api.taskPage(tasks) } });

async function pick(label: RegExp, option: string) {
  await userEvent.click(await screen.findByRole('combobox', { name: label }, SLOW));
  await userEvent.click(await screen.findByRole('option', { name: new RegExp(option) }, SLOW));
}

describe('liste des tâches', () => {
  it('affiche les tâches ouvertes avec échéance, retard, responsable et liens', async () => {
    const { calls } = renderTasks(<PlanningTasksPage />, route(api.task));

    const link = await screen.findByRole('link', { name: 'Relancer le syndic' }, SLOW);
    const row = link.closest('tr');
    expect(link.getAttribute('href')).toBe(`/taches/${api.IDS.task}`);
    expect(within(row as HTMLElement).getByText('20/03/2026')).toBeTruthy();
    expect(within(row as HTMLElement).getByText('En retard')).toBeTruthy();
    expect(await within(row as HTMLElement).findByText('Alex Dupont')).toBeTruthy();
    expect((await within(row as HTMLElement).findByRole('link', { name: 'Résidence des Lilas' })).getAttribute('href')).toBe(`/biens/immeubles/${api.IDS.property}`);
    expect(calls[0]?.search.get('status')).toBe('open');
    expect(screen.getByRole('link', { name: /Nouvelle tâche/ }).getAttribute('href')).toBe('/taches/nouvelle');
  });

  it('n’a aucune violation d’accessibilité', async () => {
    const { container } = renderTasks(<PlanningTasksPage />, route(api.task, { ...api.cancelledTask, title: 'Archiver le dossier' }));
    await screen.findByRole('link', { name: 'Relancer le syndic' }, SLOW);

    await expectNoA11yViolations(container);
  });

  it('transmet les filtres au serveur et revient à la première page', async () => {
    const { calls } = renderTasks(<PlanningTasksPage />, route(api.task));
    await screen.findByRole('link', { name: 'Relancer le syndic' }, SLOW);

    await pick(/^Statut/, 'Terminées');
    await waitFor(() => { expect(calls.at(-1)?.search.get('status')).toBe('done'); });
    await pick(/^Responsable/, 'Mes tâches');
    await waitFor(() => { expect(calls.at(-1)?.search.get('assignee')).toBe('me'); });
    await userEvent.click(screen.getByRole('checkbox', { name: 'En retard seulement' }));
    await waitFor(() => { expect(calls.at(-1)?.search.get('overdue')).toBe('true'); });
    await pick(/^Bien/, 'Résidence des Lilas');
    await waitFor(() => { expect(calls.at(-1)?.search.get('property')).toBe(api.IDS.property); });
  });

  it('pagine par curseur', async () => {
    const { calls } = renderTasks(<PlanningTasksPage />, { [`GET ${listUrl}`]: (call) => ({ body: call.search.get('cursor') === 'p2' ? api.taskPage([api.doneTask]) : api.taskPage([api.task], 'p2') }) });
    await screen.findByRole('link', { name: 'Relancer le syndic' }, SLOW);

    await userEvent.click(screen.getByRole('button', { name: /Suivant/ }));

    await waitFor(() => { expect(calls.at(-1)?.search.get('cursor')).toBe('p2'); });
    expect(await screen.findByText('Page 2')).toBeTruthy();
  });

  it('indique l’absence de tâche', async () => {
    renderTasks(<PlanningTasksPage />, route());

    expect(await screen.findByText(/Aucune tâche pour le moment/, undefined, SLOW)).toBeTruthy();
  });

  it('propose Réessayer après une erreur serveur et recharge', async () => {
    let attempts = 0;
    renderTasks(<PlanningTasksPage />, { [`GET ${listUrl}`]: () => (++attempts === 1 ? problem(500, 'server_error') : { body: api.taskPage([api.task]) }) });

    await userEvent.click(await screen.findByRole('button', { name: 'Réessayer' }, SLOW));

    expect(await screen.findByRole('link', { name: 'Relancer le syndic' }, SLOW)).toBeTruthy();
  });

  it('affiche un accès refusé sur un 403', async () => {
    renderTasks(<PlanningTasksPage />, { [`GET ${listUrl}`]: problem(403, 'role_forbidden') });

    expect(await screen.findByText('Accès refusé', undefined, SLOW)).toBeTruthy();
  });

  it('masque création et sélection pour un rôle en lecture', async () => {
    renderTasks(<PlanningTasksPage />, route(api.task), { role: 'accountant' });

    await screen.findByRole('link', { name: 'Relancer le syndic' }, SLOW);
    expect(screen.queryByRole('link', { name: /Nouvelle tâche/ })).toBeNull();
    expect(screen.queryByRole('checkbox', { name: /Sélectionner la tâche/ })).toBeNull();
  });

  it('termine une tâche depuis la ligne', async () => {
    const { callsTo } = renderTasks(<PlanningTasksPage />, { ...route(api.task), [`POST ${planningUrl(`/tasks/${api.IDS.task}/complete`)}`]: { body: { data: { ...api.task, status: 'done' } } } });

    await userEvent.click(await screen.findByRole('button', { name: 'Terminer la tâche Relancer le syndic' }, SLOW));

    await waitFor(() => { expect(callsTo('POST', planningUrl(`/tasks/${api.IDS.task}/complete`))).toHaveLength(1); });
  });

  it('refuse proprement de terminer une tâche déjà fermée (409)', async () => {
    renderTasks(<PlanningTasksPage />, { ...route(api.task), [`POST ${planningUrl(`/tasks/${api.IDS.task}/complete`)}`]: problem(409, 'planning_task_not_open') });

    await userEvent.click(await screen.findByRole('button', { name: 'Terminer la tâche Relancer le syndic' }, SLOW));

    expect(await screen.findByText(/déjà terminée ou annulée/, undefined, SLOW)).toBeTruthy();
  });
});

describe('actions groupées', () => {
  const second = { ...api.task, id: '0198a0a0-0000-7000-8000-0000000000f9', title: 'Envoyer les quittances' };
  const bulkUrl = (action: string) => planningUrl(`/tasks/bulk/${action}`);

  async function selectBoth() {
    await userEvent.click(await screen.findByRole('checkbox', { name: 'Sélectionner la tâche Relancer le syndic' }, SLOW));
    await userEvent.click(screen.getByRole('checkbox', { name: 'Sélectionner la tâche Envoyer les quittances' }));
  }

  it('termine les tâches sélectionnées après confirmation', async () => {
    const { callsTo } = renderTasks(<PlanningTasksPage />, { ...route(api.task, second), [`POST ${bulkUrl('complete')}`]: { body: { data: { count: 2 } } } });
    await selectBoth();
    expect(screen.getByText('2 tâches sélectionnées')).toBeTruthy();

    const bar = screen.getByRole('region', { name: 'Actions groupées' });
    await userEvent.click(within(bar).getByRole('button', { name: 'Terminer' }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Terminer' }));

    await waitFor(() => { expect(callsTo('POST', bulkUrl('complete'))[0]?.body).toEqual({ ids: [api.IDS.task, second.id] }); });
    await waitFor(() => { expect(screen.queryByRole('region', { name: 'Actions groupées' })).toBeNull(); });
  });

  it('reporte l’échéance avec la date choisie', async () => {
    const { callsTo } = renderTasks(<PlanningTasksPage />, { ...route(api.task, second), [`POST ${bulkUrl('postpone')}`]: { body: { data: { count: 2 } } } });
    await selectBoth();

    await userEvent.click(screen.getByRole('button', { name: 'Reporter' }));
    const dialog = await screen.findByRole('dialog');
    const date = within(dialog).getByLabelText(/Nouvelle échéance/);
    await userEvent.clear(date);
    await userEvent.type(date, '2026-05-04');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Reporter' }));

    await waitFor(() => { expect(callsTo('POST', bulkUrl('postpone'))[0]?.body).toEqual({ ids: [api.IDS.task, second.id], due_on: '2026-05-04' }); });
  });

  it('assigne les tâches à un membre et valide le choix', async () => {
    const { callsTo } = renderTasks(<PlanningTasksPage />, { ...route(api.task, second), [`POST ${bulkUrl('assign')}`]: { body: { data: { count: 2 } } } });
    await selectBoth();

    await userEvent.click(screen.getByRole('button', { name: 'Assigner' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Assigner' }));
    expect(await within(dialog).findByText('Choisissez le nouveau responsable.')).toBeTruthy();
    expect(callsTo('POST', bulkUrl('assign'))).toHaveLength(0);

    await userEvent.click(within(dialog).getByRole('combobox', { name: /Nouveau responsable/ }));
    await userEvent.click(await screen.findByRole('option', { name: /Alex Dupont/ }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Assigner' }));

    await waitFor(() => { expect(callsTo('POST', bulkUrl('assign'))[0]?.body).toEqual({ ids: [api.IDS.task, second.id], assignee_user_id: api.IDS.colleague }); });
  });

  it('affiche l’erreur du serveur dans la fenêtre sans rien fermer (404 lot inconnu)', async () => {
    renderTasks(<PlanningTasksPage />, { ...route(api.task, second), [`POST ${bulkUrl('complete')}`]: problem(404, 'planning_task_not_found') });
    await selectBoth();

    const bar = screen.getByRole('region', { name: 'Actions groupées' });
    await userEvent.click(within(bar).getByRole('button', { name: 'Terminer' }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Terminer' }));

    expect(await screen.findByText('Cette tâche n’existe pas dans votre organisation.', undefined, SLOW)).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Actions groupées' })).toBeTruthy();
  });

  it('réinitialise la sélection quand un filtre change', async () => {
    renderTasks(<PlanningTasksPage />, route(api.task, second));
    await selectBoth();

    await userEvent.click(screen.getByRole('checkbox', { name: 'En retard seulement' }));

    await waitFor(() => { expect(screen.queryByRole('region', { name: 'Actions groupées' })).toBeNull(); });
  });
});
