import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { expectNoA11yViolations } from '../../../../test/axe';
import { norm } from '../../../../test/lots';
import * as api from './api/responses.fixtures';
import { ReconciliationDetailPage } from './ReconciliationDetailPage';
import { ReconciliationsPage } from './ReconciliationsPage';
import { bankingUrl, problem, renderBanking } from './testing';

const SLOW = { timeout: 4000 };
const listUrl = bankingUrl('/reconciliations');
const page = (data: unknown[]) => ({ data, links: {}, meta: { next_cursor: null } });
const detailUrl = (id: string) => bankingUrl(`/reconciliations/${id}`);

async function fillBuild(month: string, balance?: string) {
  await userEvent.click(await screen.findByRole('combobox', { name: /^Compte \*/ }, SLOW));
  await userEvent.click(await screen.findByRole('option', { name: /Compte courant agence/ }, SLOW));
  fireEvent.change(screen.getByLabelText(/^Mois/), { target: { value: month } });
  if (balance !== undefined) fireEvent.change(screen.getByLabelText(/^Solde saisi/), { target: { value: balance } });
}

describe('états de rapprochement : liste et calcul', () => {
  it('refuse le gestionnaire sans appeler la banque', async () => {
    const { calls } = renderBanking(<ReconciliationsPage />, {}, { role: 'manager' });
    expect(await screen.findByText('Banque indisponible pour ce compte', {}, SLOW)).toBeTruthy();
    expect(calls).toHaveLength(0);
  });

  it('liste les états avec leur écart inexpliqué', async () => {
    const { container } = renderBanking(<ReconciliationsPage />, { [`GET ${listUrl}`]: { body: page([api.reconciliation, api.reconciliationGap]) } });
    expect(await screen.findAllByText('Mars 2026', {}, SLOW)).toHaveLength(2);
    expect(norm(document.body.textContent)).toContain('Brouillon');
    await expectNoA11yViolations(container);
  });

  it('calcule un état à partir des relevés sans solde saisi et ouvre son détail', async () => {
    const { callsTo, push } = renderBanking(<ReconciliationsPage />, { [`GET ${listUrl}`]: { body: page([]) }, [`POST ${listUrl}`]: { status: 201, body: { data: api.reconciliation } } });
    await fillBuild('2026-03');
    await userEvent.click(screen.getByRole('button', { name: 'Calculer l’état' }));
    await waitFor(() => { expect(callsTo('POST', listUrl)).toHaveLength(1); }, SLOW);
    const call = callsTo('POST', listUrl)[0];
    expect(call?.form).toEqual({ bank_account_id: api.IDS.account, month: '2026-03' });
    expect(call?.headers.get('Idempotency-Key')).toMatch(/^ui-/);
    await waitFor(() => { expect(push).toHaveBeenCalledWith(`/finances/banque/etats/${api.IDS.reconciliation}`); }, SLOW);
  });

  it('exige la pièce dès qu’un solde est saisi, sans appel', async () => {
    const { callsTo } = renderBanking(<ReconciliationsPage />, { [`GET ${listUrl}`]: { body: page([]) } });
    await fillBuild('2026-03', '1480,50');
    await userEvent.click(screen.getByRole('button', { name: 'Calculer l’état' }));
    expect(await screen.findByText(/Joignez la pièce qui justifie le solde saisi/, {}, SLOW)).toBeTruthy();
    expect(callsTo('POST', listUrl)).toHaveLength(0);
  });

  it('envoie le solde en unités mineures avec la pièce', async () => {
    const { callsTo } = renderBanking(<ReconciliationsPage />, { [`GET ${listUrl}`]: { body: page([]) }, [`POST ${listUrl}`]: { status: 201, body: { data: api.reconciliationValidated } } });
    await fillBuild('2026-03', '1480,50');
    await userEvent.upload(await screen.findByLabelText(/^Pièce justificative/, {}, SLOW), new File(['pdf'], 'releve.pdf', { type: 'application/pdf' }));
    await userEvent.click(screen.getByRole('button', { name: 'Calculer l’état' }));
    await waitFor(() => { expect(callsTo('POST', listUrl)).toHaveLength(1); }, SLOW);
    expect(callsTo('POST', listUrl)[0]?.form).toMatchObject({ bank_balance: '148050', proof: 'file:releve.pdf:3' });
  });

  it.each([
    ['pièce obligatoire côté serveur', problem(422, 'bank_reconciliation_proof_required'), /exige la pièce/],
    ['aucun solde de clôture', problem(422, 'bank_reconciliation_balance_required'), /saisissez le solde du relevé/],
    ['409 requête concurrente', problem(409, 'banking_request_conflict'), /requête concurrente/],
    ['429', problem(429, 'throttled'), /Trop de requêtes/],
  ])('traduit l’erreur de calcul %s', async (_name, reply, expected) => {
    renderBanking(<ReconciliationsPage />, { [`GET ${listUrl}`]: { body: page([]) }, [`POST ${listUrl}`]: reply });
    await fillBuild('2026-03');
    await userEvent.click(screen.getByRole('button', { name: 'Calculer l’état' }));
    expect(await screen.findByText(expected, {}, SLOW)).toBeTruthy();
  });
});

describe('état de rapprochement : détail et validation', () => {
  it('affiche les chiffres et valide un état sans écart', async () => {
    const validateUrl = bankingUrl(`/reconciliations/${api.IDS.reconciliation}/validate`);
    const { container, callsTo } = renderBanking(<ReconciliationDetailPage id={api.IDS.reconciliation} />, {
      [`GET ${detailUrl(api.IDS.reconciliation)}`]: { body: { data: api.reconciliation } },
      [`POST ${validateUrl}`]: { body: { data: api.reconciliationValidated } },
    });
    expect(await screen.findByRole('heading', { name: 'État de Mars 2026' }, SLOW)).toBeTruthy();
    expect(norm(document.body.textContent)).toContain('Solde du relevé');
    await expectNoA11yViolations(container);
    await userEvent.click(screen.getByRole('button', { name: 'Valider l’état' }));
    const dialog = await screen.findByRole('dialog', { name: 'Valider cet état ?' });
    expect(callsTo('POST', validateUrl)).toHaveLength(0);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Valider l’état' }));
    await waitFor(() => { expect(callsTo('POST', validateUrl)).toHaveLength(1); }, SLOW);
    expect(callsTo('POST', validateUrl)[0]?.headers.get('Idempotency-Key')).toMatch(/^ui-/);
  });

  it('bloque la validation avec un écart inexpliqué et un trou entre relevés', async () => {
    renderBanking(<ReconciliationDetailPage id={api.IDS.reconciliationValidated} />, { [`GET ${detailUrl(api.IDS.reconciliationValidated)}`]: { body: { data: api.reconciliationGap } } });
    expect(await screen.findByText('Écart inexpliqué', { selector: '[role="alert"] *, h3, strong, p, div' }, SLOW)).toBeTruthy();
    expect(screen.getByText('Trou entre deux relevés')).toBeTruthy();
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Valider l’état' }).disabled).toBe(true);
  });

  it('traduit le refus de validation pour écart inexpliqué (422)', async () => {
    const validateUrl = bankingUrl(`/reconciliations/${api.IDS.reconciliation}/validate`);
    renderBanking(<ReconciliationDetailPage id={api.IDS.reconciliation} />, {
      [`GET ${detailUrl(api.IDS.reconciliation)}`]: { body: { data: api.reconciliation } },
      [`POST ${validateUrl}`]: problem(422, 'bank_reconciliation_unexplained_difference'),
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Valider l’état' }, SLOW));
    await userEvent.click(within(await screen.findByRole('dialog', { name: 'Valider cet état ?' })).getByRole('button', { name: 'Valider l’état' }));
    expect(await screen.findByText('L’écart inexpliqué doit être nul pour valider l’état.', {}, SLOW)).toBeTruthy();
  });

  it('télécharge la pièce du solde saisi', async () => {
    const proofUrl = bankingUrl(`/reconciliations/${api.IDS.reconciliationValidated}/proof`);
    const { callsTo } = renderBanking(<ReconciliationDetailPage id={api.IDS.reconciliationValidated} />, {
      [`GET ${detailUrl(api.IDS.reconciliationValidated)}`]: { body: { data: api.reconciliationValidated } },
      [`GET ${proofUrl}`]: { file: { type: 'application/pdf', content: '%PDF' } },
    });
    URL.createObjectURL = () => 'blob:test';
    URL.revokeObjectURL = () => undefined;
    await userEvent.click(await screen.findByRole('button', { name: 'Télécharger la pièce du solde' }, SLOW));
    await waitFor(() => { expect(callsTo('GET', proofUrl)).toHaveLength(1); }, SLOW);
    expect(screen.queryByRole('button', { name: 'Valider l’état' })).toBeNull();
    expect(norm(document.body.textContent)).toContain('Solde saisi, avec pièce justificative');
  });

  it('affiche un état introuvable (404)', async () => {
    renderBanking(<ReconciliationDetailPage id={api.IDS.reconciliation} />, { [`GET ${detailUrl(api.IDS.reconciliation)}`]: problem(404, 'bank_reconciliation_not_found') });
    expect(await screen.findByText('État introuvable', {}, SLOW)).toBeTruthy();
  });
});
