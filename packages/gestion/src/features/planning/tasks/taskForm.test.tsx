import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { expectNoA11yViolations } from '../../../../test/axe';
import * as api from '../api/fixtures';
import { PlanningTaskFormPage } from './PlanningTaskFormPage';
import { planningUrl, problem, renderTasks } from './testing';

const SLOW = { timeout: 4000 };
const listUrl = planningUrl('/tasks');
const taskUrl = planningUrl(`/tasks/${api.IDS.task}`);
const showUrl = (id: string) => planningUrl(`/tasks/${id}`);
const showRoute = <T extends { id: string }>(task: T) => ({ [`GET ${showUrl(task.id)}`]: { body: { data: task } } });
const missingRoute = { [`GET ${showUrl(api.IDS.task)}`]: problem(404, 'planning_task_not_found') };

const type = (label: RegExp, value: string) => { fireEvent.change(screen.getByLabelText(label), { target: { value } }); };
const submit = (label: string) => userEvent.click(screen.getByRole('button', { name: label }));
const fillTitle = async (value = 'Relancer le syndic') => { type(/^Titre/, value); await screen.findByDisplayValue(value); };

afterEach(() => { vi.useRealTimers(); });

describe('création d’une tâche', () => {
  it('envoie les champs saisis avec un client_id uuid, sans champ interdit, puis ouvre la tâche', async () => {
    const { callsTo, push } = renderTasks(<PlanningTaskFormPage />, { [`POST ${listUrl}`]: { status: 201, body: { data: api.task } } });
    await screen.findByRole('button', { name: 'Créer la tâche' }, SLOW);

    type(/^Titre/, '  Relancer le syndic ');
    type(/^Échéance/, '2026-03-20');
    type(/^Rappel/, '3');
    await userEvent.click(screen.getByRole('combobox', { name: /^Responsable/ }));
    await userEvent.click(await screen.findByRole('option', { name: /Alex Dupont/ }));
    await submit('Créer la tâche');

    await waitFor(() => { expect(push).toHaveBeenCalledWith(`/taches/${api.IDS.task}`); }, SLOW);
    const body = callsTo('POST', listUrl)[0]?.body as Record<string, unknown>;
    expect(body).toMatchObject({ title: 'Relancer le syndic', due_on: '2026-03-20', assignee_user_id: api.IDS.colleague, remind_days_before: 3, property_id: null, unit_id: null, lease_id: null });
    expect(body.client_id).toMatch(/^[0-9a-f-]{36}$/);
    for (const forbidden of ['status', 'created_by_user_id', 'done_by_user_id', 'organization_id', 'lock_version']) expect(body).not.toHaveProperty(forbidden);
  });

  it('n’a aucune violation d’accessibilité', async () => {
    const { container } = renderTasks(<PlanningTaskFormPage />, {});
    await screen.findByRole('button', { name: 'Créer la tâche' }, SLOW);

    await expectNoA11yViolations(container);
  });

  it('refuse un formulaire invalide sans appeler le serveur et nomme les champs', async () => {
    const { callsTo } = renderTasks(<PlanningTaskFormPage />, {});
    await screen.findByRole('button', { name: 'Créer la tâche' }, SLOW);

    await submit('Créer la tâche');
    expect(await screen.findByText('Indiquez un titre.')).toBeTruthy();

    await fillTitle('Relancer <script>');
    type(/^Rappel/, '120');
    await submit('Créer la tâche');
    expect(await screen.findByText('Le titre ne peut pas contenir les caractères < et >.')).toBeTruthy();
    expect(screen.getByText('Indiquez un nombre de jours entre 0 et 90.')).toBeTruthy();
    expect(callsTo('POST', listUrl)).toHaveLength(0);
  });

  it.each([
    [422, 'planning_link_invalid', /ne correspond pas aux autres liens/],
    [422, 'planning_assignee_invalid', /membre actif/],
    [409, 'idempotency_key_reused', /déjà été enregistrée/],
    [403, 'role_forbidden', /Votre rôle ne permet pas/],
    [429, 'too_many_requests', /Trop de requêtes/],
  ])('affiche l’erreur serveur %i %s sans quitter le formulaire', async (status, code, message) => {
    const { push } = renderTasks(<PlanningTaskFormPage />, { [`POST ${listUrl}`]: problem(status, code, 'detail serveur') });
    await screen.findByRole('button', { name: 'Créer la tâche' }, SLOW);
    await fillTitle();

    await submit('Créer la tâche');

    expect(await screen.findByText(message, undefined, SLOW)).toBeTruthy();
    expect(push).not.toHaveBeenCalled();
  });

  it('refuse l’écran à un rôle en lecture seule', async () => {
    renderTasks(<PlanningTaskFormPage />, {}, { role: 'accountant' });

    expect(await screen.findByText('Accès refusé', undefined, SLOW)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Créer la tâche' })).toBeNull();
  });

  it('préremplit le bien, le lot et le bail depuis l’adresse, en ignorant une valeur invalide', async () => {
    const { callsTo } = renderTasks(<PlanningTaskFormPage />, { [`POST ${listUrl}`]: { status: 201, body: { data: api.task } } }, { search: `bien=${api.IDS.property}&lot=${api.IDS.unit}&bail=pas-un-uuid` });
    await screen.findByRole('button', { name: 'Créer la tâche' }, SLOW);
    await fillTitle();

    await submit('Créer la tâche');

    await waitFor(() => { expect(callsTo('POST', listUrl)).toHaveLength(1); }, SLOW);
    expect(callsTo('POST', listUrl)[0]?.body).toMatchObject({ property_id: api.IDS.property, unit_id: api.IDS.unit, lease_id: null });
  });

  it.each([
    ['Europe/Paris', '2026-03-29'],
    ['America/Toronto', '2026-03-28'],
  ])('propose comme échéance le jour local de l’organisation à la nuit du changement d’heure (%s)', async (timezone, expected) => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-03-28T23:30:00Z'));
    renderTasks(<PlanningTaskFormPage />, {}, { timezone });

    expect(await screen.findByLabelText(/^Échéance/, undefined, SLOW)).toHaveProperty('value', expected);
  });
});

describe('modification d’une tâche', () => {
  it('précharge la tâche et envoie lock_version avec les champs', async () => {
    const { callsTo, push } = renderTasks(<PlanningTaskFormPage id={api.IDS.task} />, { ...showRoute(api.task), [`PATCH ${taskUrl}`]: { body: { data: { ...api.task, title: 'Relancer le syndic (2)', lock_version: 2 } } } });
    await screen.findByDisplayValue('Relancer le syndic', undefined, SLOW);

    await fillTitle('Relancer le syndic (2)');
    await submit('Enregistrer');

    await waitFor(() => { expect(push).toHaveBeenCalledWith(`/taches/${api.IDS.task}`); }, SLOW);
    expect(callsTo('PATCH', taskUrl)[0]?.body).toMatchObject({ lock_version: 1, title: 'Relancer le syndic (2)', due_on: '2026-03-20', assignee_user_id: api.IDS.colleague, property_id: api.IDS.property, remind_days_before: 3 });
  });

  it('recharge la tâche et prévient l’utilisateur sur un conflit de version (409)', async () => {
    let reads = 0;
    renderTasks(<PlanningTaskFormPage id={api.IDS.task} />, {
      [`GET ${taskUrl}`]: () => ({ body: { data: ++reads === 1 ? api.task : { ...api.task, title: 'Titre modifié ailleurs', lock_version: 2 } } }),
      [`PATCH ${taskUrl}`]: problem(409, 'planning_version_conflict'),
    });
    await screen.findByDisplayValue('Relancer le syndic', undefined, SLOW);

    await submit('Enregistrer');

    expect(await screen.findByText('Tâche rechargée', undefined, SLOW)).toBeTruthy();
    expect(await screen.findByDisplayValue('Titre modifié ailleurs', undefined, SLOW)).toBeTruthy();
  });

  it('refuse de modifier une tâche terminée', async () => {
    renderTasks(<PlanningTaskFormPage id={api.IDS.taskDone} />, showRoute(api.doneTask));

    expect(await screen.findByText('Tâche non modifiable', undefined, SLOW)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Enregistrer' })).toBeNull();
  });

  it('indique une tâche introuvable (404)', async () => {
    renderTasks(<PlanningTaskFormPage id={api.IDS.task} />, missingRoute);

    expect(await screen.findByText('Tâche introuvable', undefined, SLOW)).toBeTruthy();
  });

  it('signale un responsable devenu inactif et le garde tant qu’on ne le change pas', async () => {
    const { callsTo } = renderTasks(<PlanningTaskFormPage id={api.IDS.task} />, { ...showRoute({ ...api.task, assignee_user_id: '0198a0a0-0000-7000-8000-0000000000aa', assignee_active: false }), [`PATCH ${taskUrl}`]: { body: { data: api.task } } });
    await screen.findByDisplayValue('Relancer le syndic', undefined, SLOW);

    expect(await screen.findByText(/a quitté l’organisation/)).toBeTruthy();
    await submit('Enregistrer');

    await waitFor(() => { expect(callsTo('PATCH', taskUrl)).toHaveLength(1); }, SLOW);
    expect(callsTo('PATCH', taskUrl)[0]?.body).toMatchObject({ assignee_user_id: '0198a0a0-0000-7000-8000-0000000000aa' });
  });
});
