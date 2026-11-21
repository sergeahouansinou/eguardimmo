import { screen, waitFor, within, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { expectNoA11yViolations } from '../../../../test/axe';
import { norm } from '../../../../test/lots';
import * as api from './api/responses.fixtures';
import { ExerciseDetailPage } from './ExerciseDetailPage';
import { ExerciseFormPage } from './ExerciseFormPage';
import { ExercisesPage } from './ExercisesPage';
import { saveBlob } from '../rent/download';
import { chargesUrl, problem, renderCharges } from './testing';
import type { MockRoute } from './api/testing';

vi.mock('../rent/download', () => ({ saveBlob: vi.fn() }));

const SLOW = { timeout: 4000 };
const exercisesUrl = chargesUrl('/exercises');
const exerciseUrl = (suffix = '') => chargesUrl(`/exercises/${api.IDS.exercise}${suffix}`);
const detailRoutes = (body: unknown, extra: Record<string, MockRoute> = {}): Record<string, MockRoute> => ({
  [`GET ${exerciseUrl()}`]: { body: { data: body } },
  [`GET ${chargesUrl('/expenses')}`]: { body: api.page([api.expense]) },
  ...extra,
});

describe('liste des exercices', () => {
  it('affiche les exercices avec leur statut et leur bien', async () => {
    const { container } = renderCharges(<ExercisesPage />, { [`GET ${exercisesUrl}`]: { body: api.page([api.exercise, { ...api.exercise, id: '01934f6e-0000-7000-8000-000000000102', status: 'issued', issued_at: '2026-11-16T10:00:00+00:00' }]) } });
    const table = await screen.findByRole('table', { name: 'Exercices de charges' }, SLOW);
    await waitFor(() => { expect(within(table).getAllByText('Résidence des Lilas')).toHaveLength(2); }, SLOW);
    const text = norm(table.textContent);

    expect(text).toContain('01/01/2025 au 01/01/2026 (exclu)');
    expect(text).toContain('Brouillon');
    expect(text).toContain('Émis');
    expect(screen.getByRole('link', { name: 'Nouvel exercice' }).getAttribute('href')).toBe('/finances/charges/nouveau');
    await expectNoA11yViolations(container);
  });

  it('explique l’absence d’exercice et l’échec du chargement', async () => {
    const empty = renderCharges(<ExercisesPage />, { [`GET ${exercisesUrl}`]: { body: api.page([]) } });
    expect(await screen.findByText(/Aucun exercice\. Créez le premier/, {}, SLOW)).toBeTruthy();
    empty.unmount();

    renderCharges(<ExercisesPage />, { [`GET ${exercisesUrl}`]: problem(503, 'service_unavailable') });
    expect(await screen.findByText('Impossible de charger les exercices', {}, SLOW)).toBeTruthy();
  });

  it('un rôle sans droit n’appelle aucune donnée', async () => {
    const { calls } = renderCharges(<ExercisesPage />, {}, { role: 'viewer' });
    expect(await screen.findByText('Charges indisponibles pour ce compte')).toBeTruthy();
    expect(calls).toHaveLength(0);
  });
});

describe('création d’un exercice', () => {
  it('envoie le bien et la période puis ouvre l’exercice créé', async () => {
    const { callsTo, push } = renderCharges(<ExerciseFormPage />, { [`POST ${exercisesUrl}`]: { status: 201, body: { data: api.exerciseDetail } } });
    await userEvent.click(await screen.findByRole('combobox', { name: /^Bien/ }, SLOW));
    await userEvent.click(await screen.findByRole('option', { name: /Résidence des Lilas/ }, SLOW));
    fireEvent.change(screen.getByLabelText(/^Début/), { target: { value: '2025-01-01' } });
    fireEvent.change(screen.getByLabelText(/^Fin/), { target: { value: '2026-01-01' } });
    await userEvent.click(screen.getByRole('button', { name: 'Créer l’exercice' }));

    await waitFor(() => { expect(push).toHaveBeenCalledWith(`/finances/charges/${api.IDS.exercise}`); }, SLOW);
    expect(callsTo('POST', exercisesUrl)[0]?.body).toEqual({ property_id: api.IDS.property, period_start: '2025-01-01', period_end: '2026-01-01', items: [] });
  });

  it('refuse une fin qui ne suit pas le début et un bien manquant, sans appel', async () => {
    const { callsTo } = renderCharges(<ExerciseFormPage />, {});
    await screen.findByRole('button', { name: 'Créer l’exercice' });
    fireEvent.change(screen.getByLabelText(/^Début/), { target: { value: '2026-01-01' } });
    fireEvent.change(screen.getByLabelText(/^Fin/), { target: { value: '2026-01-01' } });
    await userEvent.click(screen.getByRole('button', { name: 'Créer l’exercice' }));

    expect(await screen.findByText('Choisissez le bien.')).toBeTruthy();
    expect(screen.getByText('La fin (exclue) doit suivre le début.')).toBeTruthy();
    expect(callsTo('POST', exercisesUrl)).toHaveLength(0);
  });

  it('traduit un chevauchement de période (409)', async () => {
    renderCharges(<ExerciseFormPage />, { [`POST ${exercisesUrl}`]: problem(409, 'charge_exercise_overlap') }, { search: `bien=${api.IDS.property}` });
    await userEvent.click(await screen.findByRole('button', { name: 'Créer l’exercice' }, SLOW));
    expect(await screen.findByText(/chevauche/i, {}, SLOW)).toBeTruthy();
  });
});

describe('exercice : brouillon et calcul', () => {
  it('préremplit les postes, calcule et signale les baux exclus', async () => {
    const { callsTo } = renderCharges(<ExerciseDetailPage id={api.IDS.exercise} />, detailRoutes(api.exerciseComputed, { [`POST ${exerciseUrl('/compute')}`]: { body: { data: api.exerciseComputed } } }));
    expect(await screen.findByDisplayValue('Nettoyage des parties communes', {}, SLOW)).toBeTruthy();
    expect(await screen.findByText('Bail non régularisé')).toBeTruthy();
    expect(screen.getByText(/Bail au forfait de charges/)).toBeTruthy();

    await userEvent.click(screen.getByRole('button', { name: 'Recalculer' }));
    await waitFor(() => { expect(callsTo('POST', exerciseUrl('/compute'))).toHaveLength(1); }, SLOW);
  });

  it('enregistre les postes avec le lock_version, la clé et les sources', async () => {
    const { callsTo } = renderCharges(<ExerciseDetailPage id={api.IDS.exercise} />, detailRoutes(api.exerciseDetail, { [`PATCH ${exerciseUrl()}`]: { body: { data: api.exerciseDetail } } }));
    const label = await screen.findByDisplayValue('Nettoyage des parties communes', {}, SLOW);
    fireEvent.change(label, { target: { value: 'Nettoyage et entretien' } });
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer les postes' }));

    await waitFor(() => { expect(callsTo('PATCH', exerciseUrl())).toHaveLength(1); }, SLOW);
    expect(callsTo('PATCH', exerciseUrl())[0]?.body).toEqual({
      lock_version: 3,
      items: [{ label: 'Nettoyage et entretien', rubric: 'cleaning', key_id: api.IDS.key, sources: [{ kind: 'expense', id: api.IDS.expense, amount: 100000 }], consumptions: [] }],
    });
  });

  it('refuse un poste sans libellé ni dépense, sans appel', async () => {
    const { callsTo } = renderCharges(<ExerciseDetailPage id={api.IDS.exercise} />, detailRoutes(api.exerciseDetail));
    await userEvent.click(await screen.findByRole('button', { name: 'Ajouter un poste' }, SLOW));
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer les postes' }));

    expect(await screen.findByText('Donnez un libellé au poste.')).toBeTruthy();
    expect(callsTo('PATCH', exerciseUrl())).toHaveLength(0);
  });

  it('refuse un poste dont on a retiré toutes les dépenses', async () => {
    const { callsTo } = renderCharges(<ExerciseDetailPage id={api.IDS.exercise} />, detailRoutes(api.exerciseDetail));
    await userEvent.click(await screen.findByRole('button', { name: 'Retirer la dépense 1' }, SLOW));
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer les postes' }));

    expect(await screen.findByText('Ajoutez au moins une dépense source.')).toBeTruthy();
    expect(callsTo('PATCH', exerciseUrl())).toHaveLength(0);
  });

  it('une version périmée (409) demande de recharger', async () => {
    renderCharges(<ExerciseDetailPage id={api.IDS.exercise} />, detailRoutes(api.exerciseDetail, { [`PATCH ${exerciseUrl()}`]: problem(409, 'charges_stale_version') }));
    await userEvent.click(await screen.findByRole('button', { name: 'Enregistrer les postes' }, SLOW));
    expect(await screen.findByText(/rechargez/i, {}, SLOW)).toBeTruthy();
  });

  it('un échec du calcul est expliqué', async () => {
    renderCharges(<ExerciseDetailPage id={api.IDS.exercise} />, detailRoutes(api.exerciseDetail, { [`POST ${exerciseUrl('/compute')}`]: problem(409, 'charge_exercise_state_invalid') }));
    await userEvent.click(await screen.findByRole('button', { name: 'Calculer les décomptes' }, SLOW));
    expect(await screen.findByText('Calcul impossible', {}, SLOW)).toBeTruthy();
  });

  it('un exercice introuvable est dit introuvable', async () => {
    renderCharges(<ExerciseDetailPage id={api.IDS.exercise} />, { [`GET ${exerciseUrl()}`]: problem(404, 'charge_exercise_not_found') });
    expect(await screen.findByText('Exercice introuvable', {}, SLOW)).toBeTruthy();
  });
});

describe('exercice : émission', () => {
  it('émet avec une clé d’idempotence, sans reconnaissance de prescription par défaut', async () => {
    const { callsTo, container } = renderCharges(<ExerciseDetailPage id={api.IDS.exercise} />, detailRoutes(api.exerciseComputed, { [`POST ${exerciseUrl('/issue')}`]: { body: { data: api.exerciseIssued } } }), { role: 'admin' });
    await userEvent.click(await screen.findByRole('button', { name: 'Émettre les décomptes' }, SLOW));
    const dialog = await screen.findByRole('dialog', { name: 'Émettre les décomptes ?' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Émettre les décomptes' }));

    await waitFor(() => { expect(callsTo('POST', exerciseUrl('/issue'))).toHaveLength(1); }, SLOW);
    expect(callsTo('POST', exerciseUrl('/issue'))[0]?.body).toEqual({});
    expect(callsTo('POST', exerciseUrl('/issue'))[0]?.headers.get('Idempotency-Key')).toMatch(/^ui-/);
    await expectNoA11yViolations(container);
  });

  it('demande la reconnaissance de prescription quand le serveur l’exige, puis la transmet', async () => {
    let count = 0;
    const issue: MockRoute = () => {
      count += 1;
      return count === 1 ? problem(422, 'charges_prescription_ack_required') : { body: { data: api.exerciseIssued } };
    };
    const { callsTo } = renderCharges(<ExerciseDetailPage id={api.IDS.exercise} />, detailRoutes(api.exerciseComputed, { [`POST ${exerciseUrl('/issue')}`]: issue }), { role: 'admin' });
    await userEvent.click(await screen.findByRole('button', { name: 'Émettre les décomptes' }, SLOW));
    const dialog = await screen.findByRole('dialog', { name: 'Émettre les décomptes ?' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Émettre les décomptes' }));

    await userEvent.click(await within(dialog).findByRole('checkbox', { name: /risque de prescription/ }, SLOW));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Émettre les décomptes' }));

    await waitFor(() => { expect(callsTo('POST', exerciseUrl('/issue'))).toHaveLength(2); }, SLOW);
    expect(callsTo('POST', exerciseUrl('/issue'))[1]?.body).toEqual({ acknowledge_prescription: true });
  });

  it('le comptable ne peut pas émettre', async () => {
    renderCharges(<ExerciseDetailPage id={api.IDS.exercise} />, detailRoutes(api.exerciseComputed), { role: 'accountant' });
    await screen.findByText('Bail non régularisé', {}, SLOW);
    expect(screen.queryByRole('button', { name: 'Émettre les décomptes' })).toBeNull();
  });

  it('un exercice émis n’est plus modifiable : ni calcul, ni édition, ni émission', async () => {
    renderCharges(<ExerciseDetailPage id={api.IDS.exercise} />, detailRoutes(api.exerciseIssued, { [`GET ${exerciseUrl('/statements.csv')}`]: { csv: 'bail;solde\n' } }), { role: 'admin' });
    await screen.findByRole('table', { name: 'Postes de charges' }, SLOW);
    expect(screen.queryByRole('button', { name: /Calculer|Recalculer|Émettre|Enregistrer les postes|Écarter/ })).toBeNull();
    expect(screen.getByRole('table', { name: 'Décomptes par bail' })).toBeTruthy();
  });

  it('exporte les décomptes en CSV', async () => {
    renderCharges(<ExerciseDetailPage id={api.IDS.exercise} />, detailRoutes(api.exerciseIssued, { [`GET ${exerciseUrl('/statements.csv')}`]: { csv: 'bail;solde\n' } }), { role: 'admin' });
    await userEvent.click(await screen.findByRole('button', { name: 'Exporter en CSV' }, SLOW));
    await waitFor(() => { expect(vi.mocked(saveBlob)).toHaveBeenCalled(); }, SLOW);
    expect(vi.mocked(saveBlob).mock.calls.at(-1)?.[1]).toBe('decomptes-2025-01-01.csv');
  });

  it('reprend l’émission d’un décompte interrompu avec une clé d’idempotence', async () => {
    const retryUrl = chargesUrl(`/statements/${api.IDS.statementFailed}/retry`);
    const { callsTo } = renderCharges(<ExerciseDetailPage id={api.IDS.exercise} />, detailRoutes(api.exerciseIssuing, { [`POST ${retryUrl}`]: { body: { data: { ...api.statement, id: api.IDS.statementFailed } } } }), { role: 'admin' });
    expect(await screen.findByText(/service de PDF était indisponible/, {}, SLOW)).toBeTruthy();
    expect(screen.getAllByText('Émission en cours').length).toBeGreaterThan(1);
    await userEvent.click(screen.getByRole('button', { name: 'Reprendre l’émission' }));

    await waitFor(() => { expect(callsTo('POST', retryUrl)).toHaveLength(1); }, SLOW);
    expect(callsTo('POST', retryUrl)[0]?.headers.get('Idempotency-Key')).toMatch(/^ui-/);
  });

  it('écarte l’exercice après confirmation puis revient à la liste', async () => {
    const { callsTo, push } = renderCharges(<ExerciseDetailPage id={api.IDS.exercise} />, detailRoutes(api.exerciseDetail, { [`POST ${exerciseUrl('/discard')}`]: { body: { data: { ...api.exercise, status: 'discarded' } } } }));
    await userEvent.click(await screen.findByRole('button', { name: 'Écarter l’exercice' }, SLOW));
    const dialog = await screen.findByRole('dialog', { name: 'Écarter cet exercice ?' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Écarter l’exercice' }));

    await waitFor(() => { expect(push).toHaveBeenCalledWith('/finances/charges'); }, SLOW);
    expect(callsTo('POST', exerciseUrl('/discard'))).toHaveLength(1);
  });
});
