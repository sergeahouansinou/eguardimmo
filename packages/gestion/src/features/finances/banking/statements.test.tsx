import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { expectNoA11yViolations } from '../../../../test/axe';
import { norm } from '../../../../test/lots';
import { formatMoney } from '../../../format/money';
import * as api from './api/responses.fixtures';
import { StatementDetailPage } from './StatementDetailPage';
import { StatementsPage } from './StatementsPage';
import { bankingUrl, problem, renderBanking } from './testing';

const SLOW = { timeout: 4000 };
const listUrl = bankingUrl('/statements');
const page = (data: unknown[]) => ({ data, links: {}, meta: { next_cursor: null } });
const voidUrl = (id: string) => bankingUrl(`/statements/${id}/void`);

describe('relevés importés', () => {
  it('refuse le gestionnaire sans appeler la banque', async () => {
    const { calls } = renderBanking(<StatementsPage />, {}, { role: 'manager' });
    expect(await screen.findByText('Banque indisponible pour ce compte', {}, SLOW)).toBeTruthy();
    expect(calls).toHaveLength(0);
  });

  it('liste les relevés, dont un import annulé', async () => {
    const { container } = renderBanking(<StatementsPage />, { [`GET ${listUrl}`]: { body: page([api.statement, api.statementVoided]) } });
    expect(await screen.findByText('Importé', {}, SLOW)).toBeTruthy();
    expect(screen.getByText('Annulé')).toBeTruthy();
    expect(norm(document.body.textContent)).toContain('01/03/2026 au 31/03/2026');
    await expectNoA11yViolations(container);
  });

  it('annule un import seulement avec un motif', async () => {
    const { callsTo } = renderBanking(<StatementsPage />, {
      [`GET ${listUrl}`]: { body: page([api.statement]) },
      [`POST ${voidUrl(api.IDS.statement)}`]: { body: { data: { ...api.statement, voided_at: '2026-04-06T10:00:00+00:00', void_reason: 'Mauvais compte' } } },
    });
    await userEvent.click(await screen.findByRole('button', { name: /Annuler l’import du 01\/03\/2026/ }, SLOW));
    const dialog = await screen.findByRole('dialog', { name: 'Annuler cet import ?' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Annuler l’import' }));
    expect(await within(dialog).findByText(/au moins 3 caractères/, {}, SLOW)).toBeTruthy();
    expect(callsTo('POST', voidUrl(api.IDS.statement))).toHaveLength(0);
    fireEvent.change(within(dialog).getByLabelText(/^Motif/), { target: { value: 'Mauvais compte' } });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Annuler l’import' }));
    await waitFor(() => { expect(callsTo('POST', voidUrl(api.IDS.statement))).toHaveLength(1); }, SLOW);
    expect(callsTo('POST', voidUrl(api.IDS.statement))[0]?.body).toEqual({ reason: 'Mauvais compte' });
  });

  it('traduit le refus d’annuler un relevé déjà pointé', async () => {
    renderBanking(<StatementsPage />, { [`GET ${listUrl}`]: { body: page([api.statement]) }, [`POST ${voidUrl(api.IDS.statement)}`]: problem(409, 'bank_statement_void_forbidden') });
    await userEvent.click(await screen.findByRole('button', { name: /Annuler l’import du 01\/03\/2026/ }, SLOW));
    const dialog = await screen.findByRole('dialog', { name: 'Annuler cet import ?' });
    fireEvent.change(within(dialog).getByLabelText(/^Motif/), { target: { value: 'Mauvais compte' } });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Annuler l’import' }));
    expect(await within(dialog).findByText(/est pointée ou couverte par un état validé/, {}, SLOW)).toBeTruthy();
  });

  it('télécharge le relevé brut', async () => {
    const fileUrl = bankingUrl(`/statements/${api.IDS.statement}/file`);
    const { callsTo } = renderBanking(<StatementsPage />, { [`GET ${listUrl}`]: { body: page([api.statement]) }, [`GET ${fileUrl}`]: { file: { type: 'text/csv', content: 'a;b' } } });
    URL.createObjectURL = () => 'blob:test';
    URL.revokeObjectURL = () => undefined;
    await userEvent.click(await screen.findByRole('button', { name: 'Télécharger le relevé brut' }, SLOW));
    await waitFor(() => { expect(callsTo('GET', fileUrl)).toHaveLength(1); }, SLOW);
  });

  it('signale un relevé téléchargé trop souvent (429)', async () => {
    const fileUrl = bankingUrl(`/statements/${api.IDS.statement}/file`);
    renderBanking(<StatementsPage />, { [`GET ${listUrl}`]: { body: page([api.statement]) }, [`GET ${fileUrl}`]: problem(429, 'throttled') });
    await userEvent.click(await screen.findByRole('button', { name: 'Télécharger le relevé brut' }, SLOW));
    expect(await screen.findByText(/Trop de requêtes/, {}, SLOW)).toBeTruthy();
  });
});

describe('détail d’un relevé', () => {
  const detailUrl = bankingUrl(`/statements/${api.IDS.statement}`);

  it('affiche le trou entre deux relevés avec les soldes attendu et constaté', async () => {
    const { container } = renderBanking(<StatementDetailPage id={api.IDS.statement} />, { [`GET ${detailUrl}`]: { body: { data: api.statement, meta: { gaps: [api.gap] } } } });
    expect(await screen.findByText('Trou entre deux relevés', {}, SLOW)).toBeTruthy();
    expect(norm(document.body.textContent)).toContain(norm(`attendu est ${formatMoney(1250050, 'EUR')} mais ce relevé indique ${formatMoney(1200000, 'EUR')}`));
    await expectNoA11yViolations(container);
  });

  it('affiche le motif d’un import annulé et masque l’annulation', async () => {
    renderBanking(<StatementDetailPage id={api.IDS.statementPrev} />, { [`GET ${bankingUrl(`/statements/${api.IDS.statementPrev}`)}`]: { body: { data: api.statementVoided, meta: { gaps: [] } } } });
    expect(await screen.findByText(/Mauvais compte sélectionné/, {}, SLOW)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Annuler l’import' })).toBeNull();
  });

  it('affiche un relevé introuvable (404)', async () => {
    renderBanking(<StatementDetailPage id={api.IDS.statement} />, { [`GET ${detailUrl}`]: problem(404, 'bank_statement_not_found') });
    expect(await screen.findByText('Relevé introuvable', {}, SLOW)).toBeTruthy();
  });
});
