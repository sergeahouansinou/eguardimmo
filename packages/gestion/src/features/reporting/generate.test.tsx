import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { expectNoA11yViolations } from '../../../test/axe';
import * as api from './api/responses.fixtures';
import { GeneratePage } from './GeneratePage';
import { renderReporting, reportingUrl } from './testing';

const SLOW = { timeout: 4000 };
const CREATE = `POST ${reportingUrl('/management-reports')}`;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-18T10:00:00Z'));
});

afterEach(() => {
  vi.useRealTimers();
});

const mandantBox = (name: string) => screen.findByRole('checkbox', { name }, SLOW);
const generateButton = () => screen.getByRole('button', { name: 'Générer les comptes rendus' });

describe('génération par lot', () => {
  it('propose le mois écoulé et les mandants du serveur, sans rien sélectionner', async () => {
    const { container } = renderReporting(<GeneratePage />, {});
    await mandantBox('Awa Diallo');
    expect(screen.getByLabelText<HTMLInputElement>('Début').value).toBe('2026-10-01');
    expect(screen.getByLabelText<HTMLInputElement>('Fin').value).toBe('2026-10-31');
    expect((generateButton() as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText('0 sélectionné sur 50 au plus')).toBeTruthy();
    await expectNoA11yViolations(container);
  });

  it('reprend la période et les mandants du lien « Générer maintenant »', async () => {
    renderReporting(<GeneratePage />, {}, { search: `du=2026-09-01&au=2026-09-30&mandants=${api.IDS.mandantA}` });
    expect(((await mandantBox('Awa Diallo')) as HTMLInputElement).checked).toBe(true);
    expect(screen.getByLabelText<HTMLInputElement>('Début').value).toBe('2026-09-01');
    expect((generateButton() as HTMLButtonElement).disabled).toBe(false);
  });

  it('génère un seul mandant, envoie la clé d’idempotence et ouvre le compte rendu', async () => {
    const { callsTo, push } = renderReporting(<GeneratePage />, { [CREATE]: { status: 201, body: api.createdOne } });
    const user = userEvent.setup();
    await user.click(await mandantBox('Awa Diallo'));
    await user.click(generateButton());
    await waitFor(() => { expect(callsTo('POST', reportingUrl('/management-reports'))).toHaveLength(1); }, SLOW);
    const call = callsTo('POST', reportingUrl('/management-reports'))[0];
    expect(call?.headers.get('Idempotency-Key')).toMatch(/^[A-Za-z0-9._:-]{8,120}$/);
    expect(call?.body).toEqual({
      period_kind: 'monthly',
      period_start: '2026-10-01',
      period_end: '2026-10-31',
      mandant_ids: [api.IDS.mandantA],
      sections: ['rent', 'fees', 'payout', 'arrears', 'receipts'],
      options: { letterhead: true, reminder_detail: false, receipts_attached: false },
      mode: 'generate',
      notify: true,
    });
    await waitFor(() => { expect(push).toHaveBeenCalledWith(`/comptes-rendus/${api.IDS.reportGenerated}/apercu`); }, SLOW);
  });

  it('crée des brouillons sans génération', async () => {
    const { callsTo } = renderReporting(<GeneratePage />, { [CREATE]: { status: 201, body: api.createdOne } });
    const user = userEvent.setup();
    await user.click(await mandantBox('Awa Diallo'));
    await user.click(screen.getByRole('button', { name: 'Créer des brouillons' }));
    await waitFor(() => { expect(callsTo('POST', reportingUrl('/management-reports'))).toHaveLength(1); }, SLOW);
    expect((callsTo('POST', reportingUrl('/management-reports'))[0]?.body as { mode: string }).mode).toBe('draft');
  });

  it('un lot partiellement réussi affiche le résultat de chaque mandant', async () => {
    const { container, push } = renderReporting(<GeneratePage />, { [CREATE]: { status: 201, body: api.createdMixed } });
    const user = userEvent.setup();
    await user.click(await mandantBox('Awa Diallo'));
    await user.click(await mandantBox('SCI Les Tilleuls'));
    await user.click(generateButton());
    const table = await screen.findByRole('table', { name: 'Résultat de la génération' }, SLOW);
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows[0]?.textContent).toContain('Créé');
    expect(rows[1]?.textContent).toContain('Échec');
    expect(rows[1]?.textContent).toContain('Un compte rendu en cours ou publié couvre déjà tout ou partie de cette période pour ce mandant.');
    expect(screen.getByText('1 mandant en échec')).toBeTruthy();
    expect(push).not.toHaveBeenCalled();
    await expectNoA11yViolations(container);
  });

  it('un échec total garde le détail par mandant malgré le statut d’erreur', async () => {
    renderReporting(<GeneratePage />, { [CREATE]: { status: 409, body: api.createdAllFailed } });
    const user = userEvent.setup();
    await user.click(await mandantBox('Awa Diallo'));
    await user.click(generateButton());
    const table = await screen.findByRole('table', { name: 'Résultat de la génération' }, SLOW);
    expect(within(table).getByText('Un compte rendu en cours ou publié couvre déjà tout ou partie de cette période pour ce mandant.')).toBeTruthy();
  });

  it('rejouer la même saisie réutilise la clé, la modifier en change', async () => {
    const { callsTo } = renderReporting(<GeneratePage />, { [CREATE]: { status: 409, body: api.createdAllFailed } });
    const user = userEvent.setup();
    await user.click(await mandantBox('Awa Diallo'));
    await user.click(generateButton());
    await screen.findByRole('table', { name: 'Résultat de la génération' }, SLOW);
    await user.click(generateButton());
    await waitFor(() => { expect(callsTo('POST', reportingUrl('/management-reports'))).toHaveLength(2); }, SLOW);
    await user.click(screen.getByRole('checkbox', { name: 'Impayés en cours' }));
    await user.click(generateButton());
    await waitFor(() => { expect(callsTo('POST', reportingUrl('/management-reports'))).toHaveLength(3); }, SLOW);
    const keys = callsTo('POST', reportingUrl('/management-reports')).map((call) => call.headers.get('Idempotency-Key'));
    expect(keys[0]).toBe(keys[1]);
    expect(keys[2]).not.toBe(keys[0]);
  });

  it('une erreur de période est traduite sans résultat par mandant', async () => {
    renderReporting(<GeneratePage />, { [CREATE]: { status: 422, body: api.problem('report_period_not_closed', 'x') } });
    const user = userEvent.setup();
    await user.click(await mandantBox('Awa Diallo'));
    await user.click(generateButton());
    expect(await screen.findByText('Un compte rendu ne se publie que lorsque tous les mois de sa période sont clos en comptabilité : clôturez les mois concernés, puis publiez.', undefined, SLOW)).toBeTruthy();
    expect(screen.queryByRole('table', { name: 'Résultat de la génération' })).toBeNull();
  });

  it('retirer toutes les sections désactive les boutons', async () => {
    renderReporting(<GeneratePage />, {}, { search: `mandants=${api.IDS.mandantA}` });
    await mandantBox('Awa Diallo');
    const user = userEvent.setup();
    const fieldset = screen.getByRole('group', { name: 'Sections du compte rendu' });
    for (const box of within(fieldset).getAllByRole('checkbox')) {
      if ((box as HTMLInputElement).checked) await user.click(box);
    }
    expect(await screen.findByText('Aucune section choisie')).toBeTruthy();
    expect((generateButton() as HTMLButtonElement).disabled).toBe(true);
  });

  it('une organisation de type particulier ne charge aucun mandant', async () => {
    const { callsTo } = renderReporting(<GeneratePage />, {}, { kind: 'individual' });
    expect(await screen.findByText('Comptes rendus indisponibles pour ce compte', undefined, SLOW)).toBeTruthy();
    expect(callsTo('GET', `/api/v1/org/${api.IDS.org}/mandates/mandants`)).toHaveLength(0);
  });
});
