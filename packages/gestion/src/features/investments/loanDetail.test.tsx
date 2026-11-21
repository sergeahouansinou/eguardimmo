import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { expectNoA11yViolations } from '../../../test/axe';
import { LoanDetailPage } from './LoanDetailPage';
import * as api from './api/fixtures';
import { investmentsUrl, problem, renderInvestments } from './testing';

const SLOW = { timeout: 4000 };
const loanPath = `/loans/${api.IDS.loan}`;
const show = `GET ${investmentsUrl(loanPath)}`;
const schedule = `GET ${investmentsUrl(`${loanPath}/schedule`)}`;
const base = { [show]: { body: { data: api.loanDetail } }, [schedule]: { body: { data: api.schedule } } };

describe('fiche d’un prêt', () => {
  it('affiche les conditions, le restant dû daté, l’échéancier avec totaux, les frais et l’attestation', async () => {
    const { container } = renderInvestments(<LoanDetailPage id={api.IDS.loan} />, base);
    expect(await screen.findByRole('heading', { level: 1, name: 'Banque Populaire' }, SLOW)).toBeTruthy();
    expect(screen.getByText(/Selon l’échéancier au 21\/11\/2026/)).toBeTruthy();
    expect(screen.getByText('PRET-2025-0001')).toBeTruthy();
    const region = await screen.findByRole('region', { name: /Tableau d’amortissement/ }, SLOW);
    const table = within(region).getByRole('table');
    expect(table.textContent).toContain('3 échéances');
    expect(table.textContent).toMatch(/1\s261,25/);
    expect(screen.getByText('Frais de dossier')).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Attestations de la banque' }).textContent).toContain('2025');
    await expectNoA11yViolations(container);
  });

  it('affiche un prêt introuvable (404) sans erreur technique', async () => {
    renderInvestments(<LoanDetailPage id={api.IDS.loan} />, { [show]: problem(404, 'loan_not_found') });
    expect(await screen.findByText('Prêt introuvable', {}, SLOW)).toBeTruthy();
  });

  it('affiche le motif d’un prêt annulé et retire les actions', async () => {
    renderInvestments(<LoanDetailPage id={api.IDS.loan} />, { ...base, [show]: { body: { data: { ...api.loanDetail, status: 'voided', void_reason: 'Saisie en double' } } } });
    expect(await screen.findByText('Saisie en double', {}, SLOW)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Annuler la saisie' })).toBeNull();
  });

  it('n’offre aucune action à un rôle en lecture seule', async () => {
    renderInvestments(<LoanDetailPage id={api.IDS.loan} />, base, { role: 'manager' });
    await screen.findByRole('heading', { level: 1, name: 'Banque Populaire' }, SLOW);
    expect(screen.queryByRole('button', { name: 'Ajouter des frais' })).toBeNull();
  });

  it('annule la saisie après confirmation, avec le motif et la version lue', async () => {
    const { callsTo } = renderInvestments(<LoanDetailPage id={api.IDS.loan} />, { ...base, [`POST ${investmentsUrl(`${loanPath}/void`)}`]: { body: { data: api.loanTwo } } });
    await userEvent.click(await screen.findByRole('button', { name: 'Annuler la saisie' }, SLOW));
    const dialog = await screen.findByRole('dialog');
    await userEvent.type(within(dialog).getByLabelText(/Motif/), 'Saisie en double');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Annuler la saisie' }));
    await waitFor(() => { expect(callsTo('POST', investmentsUrl(`${loanPath}/void`))).toHaveLength(1); }, SLOW);
    expect(callsTo('POST', investmentsUrl(`${loanPath}/void`))[0]?.body).toEqual({ reason: 'Saisie en double', lock_version: 3 });
  });

  it('refuse un motif trop court sans appeler le serveur', async () => {
    const { callsTo } = renderInvestments(<LoanDetailPage id={api.IDS.loan} />, base);
    await userEvent.click(await screen.findByRole('button', { name: 'Annuler la saisie' }, SLOW));
    const dialog = await screen.findByRole('dialog');
    await userEvent.type(within(dialog).getByLabelText(/Motif/), 'x');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Annuler la saisie' }));
    expect(await within(dialog).findAllByText(/de 3 à 255 caractères/, {}, SLOW)).not.toHaveLength(0);
    expect(callsTo('POST', investmentsUrl(`${loanPath}/void`))).toHaveLength(0);
  });

  it('409 loan_version_conflict : message de rechargement et relecture de la fiche', async () => {
    const { callsTo } = renderInvestments(<LoanDetailPage id={api.IDS.loan} />, { ...base, [`POST ${investmentsUrl(`${loanPath}/void`)}`]: problem(409, 'loan_version_conflict') });
    await userEvent.click(await screen.findByRole('button', { name: 'Annuler la saisie' }, SLOW));
    const dialog = await screen.findByRole('dialog');
    await userEvent.type(within(dialog).getByLabelText(/Motif/), 'Saisie en double');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Annuler la saisie' }));
    expect(await within(dialog).findByText(/modifié depuis votre lecture/, {}, SLOW)).toBeTruthy();
    await waitFor(() => { expect(callsTo('GET', investmentsUrl(loanPath)).length).toBeGreaterThan(1); }, SLOW);
  });

  it('409 loan_in_use : explique que la synthèse figée bloque l’annulation', async () => {
    renderInvestments(<LoanDetailPage id={api.IDS.loan} />, { ...base, [`POST ${investmentsUrl(`${loanPath}/void`)}`]: problem(409, 'loan_in_use') });
    await userEvent.click(await screen.findByRole('button', { name: 'Annuler la saisie' }, SLOW));
    const dialog = await screen.findByRole('dialog');
    await userEvent.type(within(dialog).getByLabelText(/Motif/), 'Saisie en double');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Annuler la saisie' }));
    expect(await within(dialog).findByText(/synthèse fiscale figée s’appuie/, {}, SLOW)).toBeTruthy();
  });

  it('ajoute des frais : montant en unités mineures', async () => {
    const { callsTo } = renderInvestments(<LoanDetailPage id={api.IDS.loan} />, { ...base, [`POST ${investmentsUrl(`${loanPath}/fees`)}`]: { status: 201, body: { data: { ...api.loanDetail.fees[0], loan_id: api.IDS.loan } } } });
    await userEvent.click(await screen.findByRole('button', { name: 'Ajouter des frais' }, SLOW));
    const dialog = await screen.findByRole('dialog');
    await userEvent.type(within(dialog).getByLabelText(/Payé le/), '2025-01-10');
    await userEvent.type(within(dialog).getByLabelText(/Montant/), '1500');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Ajouter les frais' }));
    await waitFor(() => { expect(callsTo('POST', investmentsUrl(`${loanPath}/fees`))).toHaveLength(1); }, SLOW);
    expect(callsTo('POST', investmentsUrl(`${loanPath}/fees`))[0]?.body).toEqual({ kind: 'dossier', paid_on: '2025-01-10', amount: 150_000 });
  });

  it('exige la pièce de l’attestation avant tout appel', async () => {
    const { callsTo } = renderInvestments(<LoanDetailPage id={api.IDS.loan} />, base);
    await userEvent.click(await screen.findByRole('button', { name: 'Attestation de la banque' }, SLOW));
    const dialog = await screen.findByRole('dialog');
    await userEvent.type(within(dialog).getByLabelText(/Année de revenus/), '2025');
    await userEvent.type(within(dialog).getByLabelText(/Intérêts payés/), '4800');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Enregistrer l’attestation' }));
    expect(await within(dialog).findByText('Joignez l’attestation de la banque.', {}, SLOW)).toBeTruthy();
    expect(callsTo('POST', investmentsUrl(`${loanPath}/attestations`))).toHaveLength(0);
  });

  it('enregistre un remboursement anticipé à une échéance future du tableau', async () => {
    const { callsTo } = renderInvestments(<LoanDetailPage id={api.IDS.loan} />, { ...base, [`POST ${investmentsUrl(`${loanPath}/prepayments`)}`]: { status: 201, body: { data: api.loanBase } } });
    await userEvent.click(await screen.findByRole('button', { name: 'Remboursement anticipé' }, SLOW));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('combobox', { name: /À l’échéance du/ }));
    await userEvent.click(await screen.findByRole('option', { name: '05/12/2026' }));
    await userEvent.type(within(dialog).getByLabelText(/Montant remboursé/), '5000');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Enregistrer le remboursement' }));
    await waitFor(() => { expect(callsTo('POST', investmentsUrl(`${loanPath}/prepayments`))).toHaveLength(1); }, SLOW);
    expect(callsTo('POST', investmentsUrl(`${loanPath}/prepayments`))[0]?.body).toEqual({ date: '2026-12-05', amount: 500_000, option: 'reduce_term', penalty: 0, lock_version: 3 });
  });

  it('désactive le remboursement anticipé sur un tableau importé', async () => {
    renderInvestments(<LoanDetailPage id={api.IDS.loan} />, { ...base, [show]: { body: { data: { ...api.loanDetail, schedule_source: 'imported' } } } });
    const button = await screen.findByRole('button', { name: 'Remboursement anticipé' }, SLOW);
    expect(button.hasAttribute('disabled')).toBe(true);
  });
});
