import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { expectNoA11yViolations } from '../../../../test/axe';
import { norm } from '../../../../test/lots';
import * as api from './api/responses.fixtures';
import type { MockRoute } from './api/testing';
import { LinesPage } from './LinesPage';
import { LEASE_REFERENCE, bankingUrl, orgUrl, problem, renderBanking } from './testing';

const SLOW = { timeout: 4000 };
const page = (data: unknown[], next: string | null = null) => ({ data, links: {}, meta: { next_cursor: next } });
const linesUrl = bankingUrl('/lines');
const acceptUrl = bankingUrl('/suggestions/accept');

const byState = (states: Record<string, unknown[]>): MockRoute => (call) => ({ body: page(states[call.search.get('state') ?? ''] ?? []) });
const unmatched = (...lines: unknown[]): Record<string, MockRoute> => ({ [`GET ${linesUrl}`]: byState({ unmatched: lines }) });

afterEach(() => {
  vi.useRealTimers();
});

describe('pointage : accès', () => {
  it('refuse proprement le gestionnaire, sans appeler la banque', async () => {
    const { calls } = renderBanking(<LinesPage />, unmatched(api.lineLoyer), { role: 'manager' });
    expect(await screen.findByText('Banque indisponible pour ce compte', {}, SLOW)).toBeTruthy();
    expect(calls).toHaveLength(0);
    expect(screen.queryByRole('table')).toBeNull();
  });

  it.each(['owner', 'admin', 'accountant'])('ouvre le pointage au rôle %s', async (role) => {
    renderBanking(<LinesPage />, unmatched(api.lineLoyer), { role });
    expect(await screen.findByText('VIR LOYER MARS MARTIN', {}, SLOW)).toBeTruthy();
  });
});

describe('pointage : lecture', () => {
  it('affiche la proposition avec sa confiance et son explication, sans rien valider seule', async () => {
    const { container, callsTo } = renderBanking(<LinesPage />, unmatched(api.lineLoyer, api.lineNom, api.lineFaible));
    expect(await screen.findByText('VIR LOYER MARS MARTIN', {}, SLOW)).toBeTruthy();
    const text = norm(document.body.textContent);
    expect(text).toContain('Exacte');
    expect(text).toContain('Créer l’encaissement du loyer');
    expect(text).toContain('Numéro d’avis d’échéance reconnu');
    expect(text).toContain('Faible');
    expect(callsTo('POST', acceptUrl)).toHaveLength(0);
    expect(screen.queryByRole('button', { name: /Valider la proposition pour la ligne du 09\/03\/2026/ })).toBeNull();
    expect(screen.queryByRole('checkbox', { name: /09\/03\/2026/ })).toBeNull();
    await expectNoA11yViolations(container);
  });

  it('interroge les lignes du compte avec les filtres et la pagination par curseur', async () => {
    const { calls } = renderBanking(<LinesPage />, { [`GET ${linesUrl}`]: { body: page([api.lineLoyer], 'suite') } });
    await screen.findByText('VIR LOYER MARS MARTIN', {}, SLOW);
    await userEvent.click(screen.getByRole('button', { name: /Suivant/ }));
    await waitFor(() => { expect(calls.some((call) => call.search.get('cursor') === 'suite')).toBe(true); }, SLOW);
    expect(calls.find((call) => call.path === linesUrl)?.search.get('account_id')).toBe(api.IDS.account);
  });

  it('affiche l’état vide', async () => {
    renderBanking(<LinesPage />, unmatched());
    expect(await screen.findByText(/Aucune ligne à pointer/, {}, SLOW)).toBeTruthy();
  });

  it('affiche une erreur de chargement traduite', async () => {
    renderBanking(<LinesPage />, { [`GET ${linesUrl}`]: problem(422, 'bank_cursor_invalid') });
    expect(await screen.findByText(/La page demandée n’existe plus/, {}, SLOW)).toBeTruthy();
  });

  it('suit le calcul des propositions tant que des lignes n’en ont pas', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    let count = 0;
    renderBanking(<LinesPage />, {
      [`GET ${linesUrl}`]: () => {
        count += 1;
        return { body: page([count === 1 ? { ...api.lineLoyer, suggestion: null } : api.lineLoyer]) };
      },
    }, { search: 'calcul=1' });
    expect(await screen.findByText('Calcul des propositions en cours', {}, SLOW)).toBeTruthy();
    await vi.advanceTimersByTimeAsync(5200);
    await waitFor(() => { expect(screen.queryByText('Calcul des propositions en cours')).toBeNull(); }, SLOW);
    expect(norm(document.body.textContent)).toContain('Exacte');
    expect(count).toBe(2);
  });
});

describe('pointage : acceptation des propositions', () => {
  const acceptOk = (call: { body: unknown }): { body: unknown } => {
    const ids = (call.body as { suggestion_ids: string[] }).suggestion_ids;
    return { body: { data: { accepted: ids.map((id) => ({ suggestion_id: id, match_id: api.IDS.match })), skipped: [], replayed: false } } };
  };

  it('valide les propositions choisies en une fois, avec une clé d’idempotence', async () => {
    const { callsTo } = renderBanking(<LinesPage />, { ...unmatched(api.lineLoyer, api.lineNom), [`POST ${acceptUrl}`]: acceptOk });
    await screen.findByText('VIR LOYER MARS MARTIN', {}, SLOW);
    await userEvent.click(screen.getByRole('checkbox', { name: /05\/03\/2026/ }));
    await userEvent.click(screen.getByRole('checkbox', { name: /06\/03\/2026/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Valider 2 propositions' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Valider les propositions' }));

    await waitFor(() => { expect(callsTo('POST', acceptUrl)).toHaveLength(1); }, SLOW);
    const call = callsTo('POST', acceptUrl)[0];
    expect(call?.body).toEqual({ suggestion_ids: [api.IDS.suggestionA, api.IDS.suggestionB] });
    expect(call?.headers.get('Idempotency-Key')).toMatch(/^ui-/);
  });

  it('valide une proposition seule après confirmation explicite', async () => {
    const { callsTo } = renderBanking(<LinesPage />, { ...unmatched(api.lineLoyer), [`POST ${acceptUrl}`]: acceptOk });
    await userEvent.click(await screen.findByRole('button', { name: /Valider la proposition pour la ligne du 05\/03\/2026/ }, SLOW));
    expect(callsTo('POST', acceptUrl)).toHaveLength(0);
    const dialog = await screen.findByRole('dialog');
    expect(norm(dialog.textContent)).toContain('Créer l’encaissement du loyer');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Valider la proposition' }));
    await waitFor(() => { expect(callsTo('POST', acceptUrl)).toHaveLength(1); }, SLOW);
  });

  it('liste les propositions écartées par le serveur', async () => {
    renderBanking(<LinesPage />, {
      ...unmatched(api.lineLoyer),
      [`POST ${acceptUrl}`]: { body: { data: { accepted: [], skipped: [{ suggestion_id: api.IDS.suggestionA, reason: 'suggestion_not_found' }], replayed: false } } },
    });
    await userEvent.click(await screen.findByRole('button', { name: /Valider la proposition pour la ligne du 05\/03\/2026/ }, SLOW));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Valider la proposition' }));
    expect(await screen.findByText(/Proposition périmée/, {}, SLOW)).toBeTruthy();
  });

  it.each([
    ['429', problem(429, 'throttled'), /Trop de requêtes/],
    ['409 requête concurrente', problem(409, 'banking_request_conflict'), /requête concurrente/],
    ['403 double authentification absente', problem(403, 'two_factor_required'), /double authentification/],
    ['503', problem(503, 'banking_xsd_unavailable'), /camt\.053/],
  ])('affiche l’erreur %s en français dans la fenêtre', async (_name, reply, expected) => {
    renderBanking(<LinesPage />, { ...unmatched(api.lineLoyer), [`POST ${acceptUrl}`]: reply });
    await userEvent.click(await screen.findByRole('button', { name: /Valider la proposition pour la ligne du 05\/03\/2026/ }, SLOW));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Valider la proposition' }));
    expect(await screen.findByText(expected, {}, SLOW)).toBeTruthy();
  });
});

describe('pointage : création depuis une ligne', () => {
  const settleUrl = (id: string) => bankingUrl(`/lines/${id}/settle`);

  it('crée l’encaissement du loyer avec la version de la ligne', async () => {
    const { callsTo } = renderBanking(<LinesPage />, { ...unmatched(api.lineLoyer), [`POST ${settleUrl(api.IDS.lineA)}`]: { status: 201, body: { data: api.match } } });
    await userEvent.click(await screen.findByRole('button', { name: /Créer l’écriture depuis la ligne du 05\/03\/2026/ }, SLOW));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('combobox', { name: /^Bail 1/ }));
    await userEvent.click(await screen.findByRole('option', { name: new RegExp(LEASE_REFERENCE) }, SLOW));
    expect(within(dialog).getByLabelText<HTMLInputElement>('Montant').value).toBe('850,00');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Créer et pointer' }));

    await waitFor(() => { expect(callsTo('POST', settleUrl(api.IDS.lineA))).toHaveLength(1); }, SLOW);
    const call = callsTo('POST', settleUrl(api.IDS.lineA))[0];
    expect(call?.body).toEqual({ action: 'settle_lease', allocations: [{ lease_id: api.IDS.lease, amount: 85000 }], lock_version: 1 });
    expect(call?.headers.get('Idempotency-Key')).toMatch(/^ui-/);
  });

  it('refuse une répartition qui ne totalise pas la ligne, sans appel', async () => {
    const { callsTo } = renderBanking(<LinesPage />, unmatched(api.lineLoyer));
    await userEvent.click(await screen.findByRole('button', { name: /Créer l’écriture depuis la ligne du 05\/03\/2026/ }, SLOW));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('combobox', { name: /^Bail 1/ }));
    await userEvent.click(await screen.findByRole('option', { name: new RegExp(LEASE_REFERENCE) }, SLOW));
    fireEvent.change(within(dialog).getByLabelText('Montant'), { target: { value: '800,00' } });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Créer et pointer' }));
    expect(await within(dialog).findByText(/totaliser exactement/, {}, SLOW)).toBeTruthy();
    expect(callsTo('POST', settleUrl(api.IDS.lineA))).toHaveLength(0);
  });

  it('crée les frais bancaires d’une ligne au débit', async () => {
    const { callsTo } = renderBanking(<LinesPage />, { ...unmatched(api.lineFrais), [`POST ${settleUrl(api.IDS.lineD)}`]: { status: 201, body: { data: api.match } } });
    await userEvent.click(await screen.findByRole('button', { name: /Créer l’écriture depuis la ligne du 12\/03\/2026/ }, SLOW));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Créer et pointer' }));
    await waitFor(() => { expect(callsTo('POST', settleUrl(api.IDS.lineD))).toHaveLength(1); }, SLOW);
    expect(callsTo('POST', settleUrl(api.IDS.lineD))[0]?.body).toEqual({ action: 'bank_charges', lock_version: 1 });
  });

  it('règle une facture avec le reste dû proposé', async () => {
    const { callsTo } = renderBanking(<LinesPage />, {
      ...unmatched(api.lineLoyer),
      [`GET ${orgUrl('/invoices')}`]: (call) => ({ body: { data: call.search.get('status') === 'issued' ? [invoiceRow()] : [], links: { first: null, last: null, prev: null, next: null }, meta: { path: orgUrl('/invoices'), per_page: 100, next_cursor: null, prev_cursor: null } } }),
      [`POST ${settleUrl(api.IDS.lineA)}`]: { status: 201, body: { data: api.match } },
    });
    await userEvent.click(await screen.findByRole('button', { name: /Créer l’écriture depuis la ligne du 05\/03\/2026/ }, SLOW));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('combobox', { name: /^Action/ }));
    await userEvent.click(await screen.findByRole('option', { name: 'Régler une facture' }));
    await userEvent.click(await within(dialog).findByRole('combobox', { name: /^Facture/ }, SLOW));
    await userEvent.click(await screen.findByRole('option', { name: /FA-2026-0001/ }, SLOW));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Créer et pointer' }));
    await waitFor(() => { expect(callsTo('POST', settleUrl(api.IDS.lineA))).toHaveLength(1); }, SLOW);
    expect(callsTo('POST', settleUrl(api.IDS.lineA))[0]?.body).toEqual({ action: 'settle_invoice', invoice_id: invoiceRow().id, lock_version: 1 });
  });

  it('signale une ligne modifiée entre-temps (409)', async () => {
    renderBanking(<LinesPage />, { ...unmatched(api.lineFrais), [`POST ${settleUrl(api.IDS.lineD)}`]: problem(409, 'bank_line_stale') });
    await userEvent.click(await screen.findByRole('button', { name: /Créer l’écriture depuis la ligne du 12\/03\/2026/ }, SLOW));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Créer et pointer' }));
    expect(await screen.findByText(/Cette ligne a changé depuis votre lecture/, {}, SLOW)).toBeTruthy();
  });
});

function invoiceRow() {
  return {
    id: '01a1ee5a-0bb7-73fa-a273-ea6cbd9aa611',
    kind: 'invoice',
    status: 'issued',
    number: 'FA-2026-0001',
    credited_invoice_id: null,
    issued_on: '2026-11-16',
    due_on: '2026-12-16',
    service_from: '2026-11-01',
    service_to: '2026-11-30',
    recipient_party_id: '01a1ee5a-0bb7-73fa-a273-ea6cbd9aa602',
    lease_id: null,
    mandate_id: null,
    currency: 'EUR',
    total_net: api.eur(10000),
    total_tax: api.eur(2000),
    total_gross: api.eur(12000),
    outstanding: api.eur(12000),
    credit_reason: null,
    lock_version: 0,
    overdue_flagged_at: null,
    sent_at: null,
    created_at: '2026-11-16T09:00:00+00:00',
    lines: null,
    taxes: null,
    payments: null,
    replayed: null,
  };
}

describe('pointage : manuel, ignorer, restaurer, défaire', () => {
  it('pointe une ligne avec une écriture de même montant', async () => {
    const matchUrl = bankingUrl(`/lines/${api.IDS.lineB}/match`);
    const { callsTo } = renderBanking(<LinesPage />, {
      ...unmatched(api.lineNom),
      [`GET ${bankingUrl('/book-lines')}`]: { body: page([api.bookLine]) },
      [`POST ${matchUrl}`]: { status: 201, body: { data: api.match } },
    });
    await userEvent.click(await screen.findByRole('button', { name: /Pointer la ligne du 06\/03\/2026 avec des écritures/ }, SLOW));
    const dialog = await screen.findByRole('dialog');
    const confirm = within(dialog).getByRole('button', { name: 'Pointer la ligne' });
    expect((confirm as HTMLButtonElement).disabled).toBe(true);
    await userEvent.click(await within(dialog).findByRole('checkbox', {}, SLOW));
    expect(await within(dialog).findByText('Montants égaux')).toBeTruthy();
    await userEvent.click(confirm);
    await waitFor(() => { expect(callsTo('POST', matchUrl)).toHaveLength(1); }, SLOW);
    expect(callsTo('POST', matchUrl)[0]?.body).toEqual({ line_ids: [], journal_line_ids: [api.IDS.bookLine], lock_version: 1 });
  });

  it('ignore une ligne sur un compte propre avec son motif', async () => {
    const ignoreUrl = bankingUrl(`/lines/${api.IDS.lineD}/ignore`);
    const { callsTo } = renderBanking(<LinesPage />, { ...unmatched(api.lineFrais), [`POST ${ignoreUrl}`]: { body: { data: { ...api.lineFrais, state: 'ignored', ignore_reason: 'internal_transfer', lock_version: 2 } } } });
    await userEvent.click(await screen.findByRole('button', { name: /Ignorer la ligne du 12\/03\/2026/ }, SLOW));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Ignorer la ligne' }));
    await waitFor(() => { expect(callsTo('POST', ignoreUrl)).toHaveLength(1); }, SLOW);
    expect(callsTo('POST', ignoreUrl)[0]?.body).toEqual({ reason: 'internal_transfer', lock_version: 1 });
  });

  it('exige l’opération opposée sur un compte de tiers', async () => {
    const ignoreUrl = bankingUrl(`/lines/${api.IDS.lineD}/ignore`);
    const opposite = { ...api.lineFrais, id: api.IDS.lineB, direction: 'credit', signed_amount: api.eur(1500), label: 'RETOUR FRAIS' };
    const { callsTo } = renderBanking(<LinesPage />, {
      [`GET ${linesUrl}`]: (call) => ({ body: page(call.search.get('direction') === 'credit' ? [opposite] : [api.lineFrais]) }),
      [`POST ${ignoreUrl}`]: { body: { data: { ...api.lineFrais, state: 'ignored', ignore_reason: 'internal_transfer', lock_version: 2 } } },
    }, { search: `compte=${api.IDS.accountTrust}` });
    await userEvent.click(await screen.findByRole('button', { name: /Ignorer la ligne du 12\/03\/2026/ }, SLOW));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Ignorer la ligne' }));
    expect(await within(dialog).findByText(/choisissez l’opération opposée/, {}, SLOW)).toBeTruthy();
    expect(callsTo('POST', ignoreUrl)).toHaveLength(0);
    await userEvent.click(within(dialog).getByRole('combobox', { name: /^Opération opposée/ }));
    await userEvent.click(await screen.findByRole('option', { name: /RETOUR FRAIS/ }, SLOW));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Ignorer la ligne' }));
    await waitFor(() => { expect(callsTo('POST', ignoreUrl)).toHaveLength(1); }, SLOW);
    expect(callsTo('POST', ignoreUrl)[0]?.body).toEqual({ reason: 'internal_transfer', pair_line_id: api.IDS.lineB, lock_version: 1 });
  });

  it('traduit le refus d’ignorer sur le compte de tiers (403)', async () => {
    const ignoreUrl = bankingUrl(`/lines/${api.IDS.lineD}/ignore`);
    renderBanking(<LinesPage />, { ...unmatched(api.lineFrais), [`POST ${ignoreUrl}`]: problem(422, 'bank_ignore_forbidden', 'Seule une paire est ignorable.') });
    await userEvent.click(await screen.findByRole('button', { name: /Ignorer la ligne du 12\/03\/2026/ }, SLOW));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Ignorer la ligne' }));
    expect(await screen.findByText(/Ignorer cette ligne est impossible/, {}, SLOW)).toBeTruthy();
  });

  it('restaure une ligne ignorée après confirmation', async () => {
    const restoreUrl = bankingUrl(`/lines/${api.IDS.lineE}/restore`);
    const { callsTo } = renderBanking(<LinesPage />, {
      [`GET ${linesUrl}`]: byState({ ignored: [api.lineIgnored] }),
      [`POST ${restoreUrl}`]: { body: { data: { ...api.lineIgnored, state: 'unmatched', ignore_reason: null, lock_version: 4 } } },
    });
    await userEvent.click(await screen.findByRole('tab', { name: 'Ignorées' }, SLOW));
    await userEvent.click(await screen.findByRole('button', { name: /Restaurer la ligne du 16\/03\/2026/ }, SLOW));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Restaurer la ligne' }));
    await waitFor(() => { expect(callsTo('POST', restoreUrl)).toHaveLength(1); }, SLOW);
    expect(callsTo('POST', restoreUrl)[0]?.body).toEqual({ lock_version: 3 });
  });

  it('défait un pointage seulement avec un motif', async () => {
    const undoUrl = bankingUrl(`/matches/${api.IDS.match}/undo`);
    const { callsTo } = renderBanking(<LinesPage />, {
      [`GET ${linesUrl}`]: byState({ matched: [api.lineMatched] }),
      [`POST ${undoUrl}`]: { body: { data: { ...api.match, undone_at: '2026-04-06T10:00:00+00:00', undo_reason: 'Erreur' } } },
    });
    await userEvent.click(await screen.findByRole('tab', { name: 'Pointées' }, SLOW));
    await userEvent.click(await screen.findByRole('button', { name: /Défaire le pointage de la ligne du 15\/03\/2026/ }, SLOW));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Défaire le pointage' }));
    expect(await within(dialog).findByText(/au moins 3 caractères/, {}, SLOW)).toBeTruthy();
    expect(callsTo('POST', undoUrl)).toHaveLength(0);
    fireEvent.change(within(dialog).getByLabelText(/^Motif/), { target: { value: 'Mauvais locataire' } });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Défaire le pointage' }));
    await waitFor(() => { expect(callsTo('POST', undoUrl)).toHaveLength(1); }, SLOW);
    expect(callsTo('POST', undoUrl)[0]?.body).toEqual({ reason: 'Mauvais locataire' });
  });

  it('traduit le pointage verrouillé par un état validé', async () => {
    const undoUrl = bankingUrl(`/matches/${api.IDS.match}/undo`);
    renderBanking(<LinesPage />, { [`GET ${linesUrl}`]: byState({ matched: [api.lineMatched] }), [`POST ${undoUrl}`]: problem(409, 'bank_match_locked') });
    await userEvent.click(await screen.findByRole('tab', { name: 'Pointées' }, SLOW));
    await userEvent.click(await screen.findByRole('button', { name: /Défaire le pointage de la ligne du 15\/03\/2026/ }, SLOW));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText(/^Motif/), { target: { value: 'Mauvais locataire' } });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Défaire le pointage' }));
    expect(await within(dialog).findByText(/état de rapprochement validé/, {}, SLOW)).toBeTruthy();
  });
});
