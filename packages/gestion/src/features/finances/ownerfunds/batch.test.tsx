import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { expectNoA11yViolations } from '../../../../test/axe';
import { norm } from '../../../../test/lots';
import * as api from './api/responses.fixtures';
import { BatchPage } from './BatchPage';
import { ownerFundsPaths } from './paths';
import { batchRoutes, ownerFundsUrl, renderOwnerFunds } from './testing';

const SLOW = { timeout: 4000 };
const lot = (id: string) => `?lot=${id}`;
const draftId = api.IDS.batchDraft;
const validatedId = api.IDS.batchValidated;
const batchUrl = (id: string) => ownerFundsUrl(`/batches/${id}`);
const itemUrl = (action: string, item = api.IDS.itemA, batch = validatedId) => ownerFundsUrl(`/batches/${batch}/items/${item}/${action}`);
const itemOk = { body: { data: api.itemPaid } };

async function waitForTable() {
  const table = await screen.findByRole('table', { name: 'Mandants du lot' }, SLOW);
  await waitFor(() => { expect(within(table).getByText('Awa Diallo')).toBeTruthy(); }, SLOW);
  return table;
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-16T10:00:00Z'));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('lot de reversements : lecture', () => {
  it('affiche le brouillon avec les montants du serveur et les motifs', async () => {
    const { container } = renderOwnerFunds(<BatchPage />, batchRoutes(api.batchDraft), { search: lot(draftId) });
    const table = await waitForTable();
    const rows = within(table).getAllByRole('row').slice(1).map((row) => norm(row.textContent));
    expect(rows[0]).toContain('1 068 €');
    expect(rows[0]).toContain('IBAN •••• 4321');
    expect(rows[1]).toContain('SCI Les Tilleuls');
    expect(rows[1]).toContain('Aucun compte de paiement valide');
    expect(screen.getByText('Lot en préparation', { selector: 'h1' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Valider le lot' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Exporter/ })).toBeNull();
    await expectNoA11yViolations(container);
  });

  it('un lot validé annonce le second approbateur requis', async () => {
    renderOwnerFunds(<BatchPage />, batchRoutes(api.batchValidated), { search: lot(validatedId) });
    expect(await screen.findByText('Second approbateur requis', {}, SLOW)).toBeTruthy();
    expect(screen.getByText('RV-2026-0001', { selector: 'h1' })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Exporter en CSV/ })).toBeTruthy();
  });

  it('un lot annulé affiche son motif et aucune action', async () => {
    renderOwnerFunds(<BatchPage />, batchRoutes(api.batchCancelled), { search: lot(draftId) });
    expect(await screen.findByText('Erreur de sélection', {}, SLOW)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Valider le lot' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Annuler le lot' })).toBeNull();
  });

  it('sans identifiant de lot, propose de revenir aux reversements', async () => {
    renderOwnerFunds(<BatchPage />, {}, { search: '' });
    expect(await screen.findByText('Lot introuvable')).toBeTruthy();
    expect(screen.getByRole('link', { name: /Retour aux reversements/ }).getAttribute('href')).toBe(ownerFundsPaths.payouts);
  });

  it('un lot inconnu du serveur est introuvable', async () => {
    renderOwnerFunds(<BatchPage />, { [`GET ${batchUrl(draftId)}`]: { status: 404, body: api.problemBatchNotFound } }, { search: lot(draftId) });
    expect(await screen.findByText('Ce lot n’existe pas dans votre organisation.', {}, SLOW)).toBeTruthy();
  });

  it('un gestionnaire ne voit ni validation, ni annulation, ni export', async () => {
    renderOwnerFunds(<BatchPage />, batchRoutes(api.batchValidated), { search: lot(validatedId), role: 'manager' });
    await waitForTable();
    expect(screen.queryByRole('button', { name: /Exporter|Annuler|Valider|Exécuter/ })).toBeNull();
    expect(screen.getByText(/réservés au propriétaire, à l’administrateur et au comptable/)).toBeTruthy();
  });

  it('une organisation non agence n’accède pas au lot', async () => {
    renderOwnerFunds(<BatchPage />, {}, { search: lot(draftId), kind: 'individual' });
    expect(await screen.findByText(/réservés aux organisations de type agence/)).toBeTruthy();
  });
});

describe('lot de reversements : préparation', () => {
  it('exclut un mandant avec la version du lot et une clé d’idempotence', async () => {
    const exclude = itemUrl('exclude', api.IDS.itemA, draftId);
    const { callsTo } = renderOwnerFunds(<BatchPage />, { ...batchRoutes(api.batchDraft), [`POST ${exclude}`]: { body: api.batchDraftManualExclusion } }, { search: lot(draftId) });
    await waitForTable();
    await userEvent.click(await screen.findByRole('button', { name: /Exclure pour Awa Diallo/ }));

    await waitFor(() => { expect(callsTo('POST', exclude)).toHaveLength(1); });
    expect(callsTo('POST', exclude)[0]?.body).toEqual({ lock_version: 3 });
    expect(callsTo('POST', exclude)[0]?.headers.get('Idempotency-Key')).toBeTruthy();
  });

  it('réintègre un mandant exclu à la main, jamais un exclu par le serveur', async () => {
    const include = itemUrl('include', api.IDS.itemB, draftId);
    const { callsTo } = renderOwnerFunds(<BatchPage />, { ...batchRoutes(api.batchDraftManualExclusion), [`POST ${include}`]: { body: api.batchDraft } }, { search: lot(draftId) });
    await waitForTable();
    await userEvent.click(await screen.findByRole('button', { name: /Inclure pour SCI Les Tilleuls/ }));

    await waitFor(() => { expect(callsTo('POST', include)).toHaveLength(1); });
    expect(callsTo('POST', include)[0]?.body).toEqual({ lock_version: 3 });
  });

  it('ne propose pas d’inclure un mandant écarté par le serveur', async () => {
    renderOwnerFunds(<BatchPage />, batchRoutes(api.batchDraft), { search: lot(draftId) });
    await waitForTable();
    expect(screen.queryByRole('button', { name: /Inclure/ })).toBeNull();
  });

  it('affiche le conflit de version quand le lot a changé', async () => {
    const exclude = itemUrl('exclude', api.IDS.itemA, draftId);
    renderOwnerFunds(<BatchPage />, { ...batchRoutes(api.batchDraft), [`POST ${exclude}`]: { status: 409, body: api.problemStale } }, { search: lot(draftId) });
    await waitForTable();
    await userEvent.click(await screen.findByRole('button', { name: /Exclure pour Awa Diallo/ }));
    expect(await screen.findByText('Action non effectuée')).toBeTruthy();
    expect(screen.getByText(/modifié depuis votre lecture/)).toBeTruthy();
  });
});

describe('lot de reversements : validation et annulation', () => {
  it('valide le lot après confirmation', async () => {
    const validate = ownerFundsUrl(`/batches/${draftId}/validate`);
    const { callsTo } = renderOwnerFunds(<BatchPage />, { ...batchRoutes(api.batchDraft), [`POST ${validate}`]: { body: api.batchValidatedWithExclusion } }, { search: lot(draftId) });
    await waitForTable();
    await userEvent.click(screen.getByRole('button', { name: 'Valider le lot' }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Valider le lot' }));

    await waitFor(() => { expect(callsTo('POST', validate)).toHaveLength(1); });
    expect(callsTo('POST', validate)[0]?.body).toEqual({ lock_version: 3 });
    expect(callsTo('POST', validate)[0]?.headers.get('Idempotency-Key')).toBeTruthy();
  });

  it('explique l’absence de double authentification et renvoie vers Compte > Sécurité', async () => {
    const validate = ownerFundsUrl(`/batches/${draftId}/validate`);
    renderOwnerFunds(<BatchPage />, { ...batchRoutes(api.batchDraft), [`POST ${validate}`]: { status: 403, body: api.problemTwoFactor } }, { search: lot(draftId) });
    await waitForTable();
    await userEvent.click(screen.getByRole('button', { name: 'Valider le lot' }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Valider le lot' }));

    expect(await screen.findByText('Lot non validé')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Ouvrir Connexion et sécurité' }).getAttribute('href')).toBe(ownerFundsPaths.security);
  });

  it('refuse un lot non validable avec le message du serveur traduit', async () => {
    const validate = ownerFundsUrl(`/batches/${draftId}/validate`);
    renderOwnerFunds(<BatchPage />, { ...batchRoutes(api.batchDraft), [`POST ${validate}`]: { status: 409, body: api.problemNotValidatable } }, { search: lot(draftId) });
    await waitForTable();
    await userEvent.click(screen.getByRole('button', { name: 'Valider le lot' }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Valider le lot' }));
    expect(await screen.findByText('Lot non validé')).toBeTruthy();
  });

  it('exige un motif d’au moins 3 caractères pour annuler, sans appel', async () => {
    const cancel = ownerFundsUrl(`/batches/${draftId}/cancel`);
    const { callsTo } = renderOwnerFunds(<BatchPage />, { ...batchRoutes(api.batchDraft), [`POST ${cancel}`]: { body: api.batchCancelled } }, { search: lot(draftId) });
    await waitForTable();
    await userEvent.click(screen.getByRole('button', { name: 'Annuler le lot' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.type(within(dialog).getByRole('textbox', { name: /Motif/ }), 'ab');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Annuler le lot' }));

    expect(await within(dialog).findByText('Indiquez un motif de 3 à 500 caractères.')).toBeTruthy();
    expect(callsTo('POST', cancel)).toHaveLength(0);
  });

  it('annule le lot avec motif et version', async () => {
    const cancel = ownerFundsUrl(`/batches/${draftId}/cancel`);
    const { callsTo } = renderOwnerFunds(<BatchPage />, { ...batchRoutes(api.batchDraft), [`POST ${cancel}`]: { body: api.batchCancelled } }, { search: lot(draftId) });
    await waitForTable();
    await userEvent.click(screen.getByRole('button', { name: 'Annuler le lot' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.type(within(dialog).getByRole('textbox', { name: /Motif/ }), 'Erreur de sélection');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Annuler le lot' }));

    await waitFor(() => { expect(callsTo('POST', cancel)).toHaveLength(1); });
    expect(callsTo('POST', cancel)[0]?.body).toEqual({ reason: 'Erreur de sélection', lock_version: 3 });
  });
});

describe('lot de reversements : exécution des virements', () => {
  const run = async (routes: ReturnType<typeof batchRoutes>, reference = 'VIR-20261117-01') => {
    const view = renderOwnerFunds(<BatchPage />, routes, { search: lot(validatedId) });
    await waitForTable();
    await userEvent.click(await screen.findByRole('button', { name: /Exécuter pour Awa Diallo/ }));
    const dialog = await screen.findByRole('dialog');
    if (reference !== '') await userEvent.type(within(dialog).getByRole('textbox', { name: /Référence bancaire/ }), reference);
    return { ...view, dialog };
  };

  it('exécute un virement avec la date, la référence et une clé d’idempotence', async () => {
    const execute = itemUrl('execute');
    const { callsTo, dialog } = await run({ ...batchRoutes(api.batchValidated), [`POST ${execute}`]: itemOk });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Enregistrer le virement' }));

    await waitFor(() => { expect(callsTo('POST', execute)).toHaveLength(1); });
    const call = callsTo('POST', execute)[0];
    expect(call?.body).toMatchObject({ reference: 'VIR-20261117-01' });
    expect(call?.body).not.toHaveProperty('acknowledge_account_change');
    expect(call?.headers.get('Idempotency-Key')).toBeTruthy();
  });

  it('demande la reconnaissance du changement de compte puis la transmet', async () => {
    const execute = itemUrl('execute');
    let attempt = 0;
    const { callsTo, dialog } = await run({
      ...batchRoutes(api.batchValidated),
      [`POST ${execute}`]: () => { attempt += 1; return attempt === 1 ? { status: 409, body: api.problemAccountChanged } : itemOk; },
    });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Enregistrer le virement' }));
    const box = await within(dialog).findByRole('checkbox', { name: /Je reconnais le changement du compte/ });
    await userEvent.click(box);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Enregistrer le virement' }));

    await waitFor(() => { expect(callsTo('POST', execute)).toHaveLength(2); });
    expect(callsTo('POST', execute)[1]?.body).toMatchObject({ acknowledge_account_change: true });
  });

  it('signale l’obligation d’un autre validateur quand le serveur refuse', async () => {
    const execute = itemUrl('execute');
    const { dialog } = await run({ ...batchRoutes(api.batchValidated), [`POST ${execute}`]: { status: 403, body: api.problemSecondApprover } });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Enregistrer le virement' }));
    expect(await within(dialog).findByText('Virement non enregistré')).toBeTruthy();
    expect(within(dialog).getAllByText(/autre personne/).length).toBeGreaterThan(1);
  });

  it('rejette une référence invalide avant tout appel', async () => {
    const execute = itemUrl('execute');
    const { callsTo, dialog } = await run({ ...batchRoutes(api.batchValidated), [`POST ${execute}`]: itemOk }, 'ref invalide !');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Enregistrer le virement' }));
    expect(await within(dialog).findByText(/La référence compte 64 caractères au plus/)).toBeTruthy();
    expect(callsTo('POST', execute)).toHaveLength(0);
  });

  it('signale un échec de virement avec son motif', async () => {
    const fail = itemUrl('fail');
    const { callsTo } = renderOwnerFunds(<BatchPage />, { ...batchRoutes(api.batchValidated), [`POST ${fail}`]: itemOk }, { search: lot(validatedId) });
    await waitForTable();
    await userEvent.click(await screen.findByRole('button', { name: /Signaler un échec pour Awa Diallo/ }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.type(within(dialog).getByRole('textbox', { name: /Motif/ }), 'IBAN refusé par la banque');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Signaler l’échec' }));

    await waitFor(() => { expect(callsTo('POST', fail)).toHaveLength(1); });
    expect(callsTo('POST', fail)[0]?.body).toEqual({ reason: 'IBAN refusé par la banque' });
  });

  it('déclare un retour bancaire sur un virement exécuté', async () => {
    const giveBack = itemUrl('return');
    const { callsTo } = renderOwnerFunds(<BatchPage />, { ...batchRoutes(api.batchExecuted), [`POST ${giveBack}`]: itemOk }, { search: lot(validatedId) });
    await waitForTable();
    expect(screen.getByText(/VIR-20261117-01/)).toBeTruthy();
    await userEvent.click(await screen.findByRole('button', { name: /Retour bancaire pour Awa Diallo/ }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.type(within(dialog).getByRole('textbox', { name: /Motif/ }), 'Compte clôturé');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Déclarer le retour' }));

    await waitFor(() => { expect(callsTo('POST', giveBack)).toHaveLength(1); });
    expect(callsTo('POST', giveBack)[0]?.body).toEqual({ reason: 'Compte clôturé' });
  });
});

describe('lot de reversements : export', () => {
  it('télécharge le CSV du serveur', async () => {
    const createObjectURL = vi.fn<(blob: Blob) => string>(() => 'blob:csv');
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() }));
    const exportUrl = ownerFundsUrl(`/batches/${validatedId}/export`);
    const { callsTo } = renderOwnerFunds(<BatchPage />, { ...batchRoutes(api.batchValidated), [`GET ${exportUrl}`]: { csv: 'mandant;net\nAwa Diallo;1068,00\n' } }, { search: lot(validatedId) });
    await waitForTable();
    await userEvent.click(screen.getByRole('button', { name: /Exporter en CSV/ }));

    await waitFor(() => { expect(createObjectURL).toHaveBeenCalledTimes(1); });
    expect(callsTo('GET', exportUrl)).toHaveLength(1);
  });

  it('explique le refus d’export sans double authentification', async () => {
    const exportUrl = ownerFundsUrl(`/batches/${validatedId}/export`);
    renderOwnerFunds(<BatchPage />, { ...batchRoutes(api.batchValidated), [`GET ${exportUrl}`]: { status: 403, body: api.problemTwoFactor } }, { search: lot(validatedId) });
    await waitForTable();
    await userEvent.click(screen.getByRole('button', { name: /Exporter en CSV/ }));
    expect(await screen.findByRole('link', { name: 'Ouvrir Connexion et sécurité' })).toBeTruthy();
  });
});
