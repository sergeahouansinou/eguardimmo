import { createHash } from 'node:crypto';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { expectNoA11yViolations } from '../../../test/axe';
import { FROZEN_NOW, at, norm, renderLot } from '../../../test/lots';
import { QuittanceApercuPage } from './QuittanceApercuPage';
import { QuittancesPage } from './QuittancesPage';
import { receiptCanonical, receiptFingerprint, shortFingerprint, verifyReceiptFingerprint } from './receiptFingerprint';
import type { Receipt } from './schemas';

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(FROZEN_NOW);
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const receiptsOf = async (source: { receipts: () => Promise<unknown> }) => (await source.receipts()) as Receipt[];
const dataRows = (table: HTMLElement) => within(table).getAllByRole('row').slice(1);
const RECEIPT_ID = 'qt-2026-0398';

const sample: Pick<Receipt, 'number' | 'tenantId' | 'month' | 'rent' | 'charges' | 'issuedOn'> = {
  number: 'QT-2026-0001',
  tenantId: 'koffi-adjovi',
  month: '2026-10',
  rent: 70000,
  charges: 15000,
  issuedOn: '2026-10-05',
};

describe('empreinte d’une quittance', () => {
  it('est le SHA-256 du contenu canonique, stable d’un calcul à l’autre', async () => {
    const expected = createHash('sha256').update('["QT-2026-0001","koffi-adjovi","2026-10",70000,15000,"2026-10-05"]').digest('hex');
    expect(receiptCanonical(sample)).toBe('["QT-2026-0001","koffi-adjovi","2026-10",70000,15000,"2026-10-05"]');
    expect(await receiptFingerprint(sample)).toBe(expected);
    expect(await receiptFingerprint({ ...sample })).toBe(expected);
  });

  it('change dès qu’un champ du contenu change, montant compris', async () => {
    const base = await receiptFingerprint(sample);
    expect(await receiptFingerprint({ ...sample, rent: 70100 })).not.toBe(base);
    expect(await receiptFingerprint({ ...sample, charges: 14900 })).not.toBe(base);
    expect(await receiptFingerprint({ ...sample, number: 'QT-2026-0002' })).not.toBe(base);
    expect(await receiptFingerprint({ ...sample, tenantId: 'marc-dossou' })).not.toBe(base);
    expect(await receiptFingerprint({ ...sample, month: '2026-11' })).not.toBe(base);
    expect(await receiptFingerprint({ ...sample, issuedOn: '2026-10-06' })).not.toBe(base);
  });

  it('se tronque au début et à la fin', () => {
    expect(shortFingerprint('3f2a'.padEnd(60, '0') + '9c1e')).toBe('3f2a…9c1e');
  });

  it('est calculée à l’émission et vérifiable : un montant modifié est détecté', async () => {
    const { sources } = renderLot(<QuittancesPage />);
    const receipt = (await receiptsOf(sources.courriers)).find((item) => item.id === RECEIPT_ID);
    expect(receipt?.fingerprint).toMatch(/^[0-9a-f]{64}$/);
    if (!receipt) throw new Error('quittance de démonstration absente');
    expect(await verifyReceiptFingerprint(receipt)).toBe(true);
    expect(await verifyReceiptFingerprint({ ...receipt, rent: receipt.rent + 100 })).toBe(false);
    expect(await verifyReceiptFingerprint({ ...receipt, fingerprint: null })).toBe(false);
  });
});

describe('annulation d’une quittance, source', () => {
  it('annule sans supprimer : statut, motif, date, auteur, historique, et l’échéance redevient à émettre', async () => {
    const { sources } = renderLot(<QuittancesPage />);
    const before = (await receiptsOf(sources.courriers)).find((item) => item.id === RECEIPT_ID);
    const count = (await receiptsOf(sources.courriers)).length;
    await sources.courriers.cancelReceipt(RECEIPT_ID, { reason: '  Montant erroné  ' });
    const all = await receiptsOf(sources.courriers);
    const cancelled = all.find((item) => item.id === RECEIPT_ID);
    expect(cancelled).toMatchObject({ number: before?.number, fingerprint: before?.fingerprint, cancellation: { on: '2026-11-13', by: 'Gestion Les Tilleuls', reason: 'Montant erroné' } });
    expect(cancelled?.history.map((event) => event.type)).toEqual(['emise', 'envoyee', 'annulee']);
    expect(cancelled?.history.at(-1)).toMatchObject({ on: '2026-11-13', note: 'Montant erroné' });
    expect(all).toHaveLength(count + 1);
    expect(all.find((item) => item.number === null && item.leaseId === before?.leaseId && item.month === before.month)).toMatchObject({ outstanding: 0, issuedOn: null, sentOn: null });
  });

  it('refuse l’annulation sans motif', async () => {
    const { sources } = renderLot(<QuittancesPage />);
    await expect(sources.courriers.cancelReceipt(RECEIPT_ID, { reason: '   ' })).rejects.toThrow('Indiquez le motif de l’annulation');
    await expect(sources.courriers.cancelReceipt(RECEIPT_ID, {})).rejects.toThrow('Indiquez le motif de l’annulation');
    expect((await receiptsOf(sources.courriers)).find((item) => item.id === RECEIPT_ID)?.cancellation).toBeNull();
  });

  it('refuse d’annuler deux fois la même quittance et un brouillon', async () => {
    const { sources } = renderLot(<QuittancesPage />);
    await sources.courriers.cancelReceipt(RECEIPT_ID, { reason: 'Doublon' });
    await expect(sources.courriers.cancelReceipt(RECEIPT_ID, { reason: 'Encore' })).rejects.toThrow('Cette quittance est déjà annulée.');
    await expect(sources.courriers.cancelReceipt('en-attente-202611-apt-a3', { reason: 'Test' })).rejects.toThrow('Seule une quittance émise peut être annulée.');
    await expect(sources.courriers.cancelReceipt('qt-inconnue', { reason: 'Test' })).rejects.toThrow();
  });

  it('interdit l’envoi d’une quittance annulée et permet de la réémettre sous un nouveau numéro', async () => {
    const { sources } = renderLot(<QuittancesPage />);
    const original = (await receiptsOf(sources.courriers)).find((item) => item.id === RECEIPT_ID);
    await sources.courriers.cancelReceipt(RECEIPT_ID, { reason: 'Montant erroné' });
    await expect(sources.courriers.markReceiptSent(RECEIPT_ID)).rejects.toThrow('Une quittance annulée ne peut pas être envoyée.');
    await sources.courriers.emitReceipts(original?.month ?? '');
    const all = await receiptsOf(sources.courriers);
    expect(all.find((item) => item.id === RECEIPT_ID)?.cancellation).not.toBeNull();
    const reissued = all.find((item) => item.leaseId === original?.leaseId && item.month === original.month && item.cancellation === null);
    expect(reissued?.number).toBe('QT-2026-0413');
    expect(reissued?.fingerprint).toMatch(/^[0-9a-f]{64}$/);
    expect(reissued?.fingerprint).not.toBe(original?.fingerprint);
  });
});

const countOf = (name: RegExp): number => Number(/\d+/.exec(screen.getByRole('tab', { name }).textContent)?.[0]);

describe('QuittancesPage, annulation et empreinte', () => {
  const openMenu = async () => {
    await screen.findByRole('table', { name: 'Quittances' });
    await userEvent.click(at(screen.getAllByRole('button', { name: /^Plus d’actions, QT-/ }), 0));
  };

  it('annule une quittance avec un motif : elle sort des envoyées, entre dans les annulées et l’échéance redevient à émettre', async () => {
    const { sources } = renderLot(<QuittancesPage />);
    await screen.findByRole('table', { name: 'Quittances' });
    const sent = countOf(/Envoyées/);
    const toEmit = countOf(/À émettre/);
    await openMenu();
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Annuler la quittance' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Annuler la quittance' }));
    expect(await within(dialog).findByText('Indiquez le motif de l’annulation')).toBeTruthy();
    expect((await receiptsOf(sources.courriers)).filter((item) => item.cancellation !== null)).toHaveLength(0);
    await userEvent.type(within(dialog).getByLabelText('Motif de l’annulation *'), 'Montant erroné');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Annuler la quittance' }));
    await waitFor(() => { expect(screen.getByRole('tab', { name: /Annulées/ }).textContent).toContain('1'); });
    expect(screen.getByRole('tab', { name: /Envoyées/ }).textContent).toContain(String(sent - 1));
    expect(screen.getByRole('tab', { name: /À émettre/ }).textContent).toContain(String(toEmit + 1));
    expect((await receiptsOf(sources.courriers)).filter((item) => item.cancellation !== null)).toHaveLength(1);
    await userEvent.click(screen.getByRole('tab', { name: /Annulées/ }));
    const rows = dataRows(screen.getByRole('table', { name: 'Quittances' }));
    expect(rows).toHaveLength(1);
    expect(norm(at(rows, 0).textContent)).toContain('Annulée');
    const panel = await screen.findByRole('region', { name: 'Détail de la quittance' });
    expect(norm(panel.textContent)).toContain('Motif : Montant erroné');
    expect(within(panel).getByRole('button', { name: 'Annuler la quittance' }).hasAttribute('disabled')).toBe(true);
  });

  it('désactive l’annulation d’un brouillon', async () => {
    renderLot(<QuittancesPage />);
    await userEvent.click(await screen.findByRole('tab', { name: /À solder/ }));
    await userEvent.click(at(screen.getAllByRole('button', { name: /^Plus d’actions, brouillon/ }), 0));
    expect((await screen.findByRole('menuitem', { name: 'Annuler la quittance' })).getAttribute('aria-disabled')).toBe('true');
  });

  it('affiche l’empreinte tronquée, la copie et la vérifie', async () => {
    const user = userEvent.setup();
    const { container } = renderLot(<QuittancesPage />);
    await openMenu();
    await user.click(await screen.findByRole('menuitem', { name: 'Voir le détail' }));
    const panel = await screen.findByRole('region', { name: 'Détail de la quittance' });
    const short = await within(panel).findByText(/^[0-9a-f]{4}…[0-9a-f]{4}$/);
    const full = short.getAttribute('aria-label')?.replace('Empreinte SHA-256 ', '') ?? '';
    expect(full).toMatch(/^[0-9a-f]{64}$/);
    await user.click(within(panel).getByRole('button', { name: 'Copier l’empreinte' }));
    expect(await navigator.clipboard.readText()).toBe(full);
    await user.click(within(panel).getByRole('button', { name: 'Vérifier l’empreinte' }));
    expect(await within(panel).findByText('Empreinte conforme')).toBeTruthy();
    expect(norm(panel.textContent)).toContain('Historique');
    await expectNoA11yViolations(container);
  });
});

describe('QuittanceApercuPage, quittance annulée', () => {
  it('reste consultable, marquée annulée avec son motif', async () => {
    renderLot(
      <>
        <QuittancesPage />
        <QuittanceApercuPage id={RECEIPT_ID} />
      </>,
    );
    const paperName = 'Quittance de loyer QT-2026-0398';
    await screen.findByRole('article', { name: paperName });
    expect(screen.queryByText(/Quittance annulée le/)).toBeNull();
    await userEvent.type(await screen.findByRole('searchbox', { name: 'Rechercher une quittance' }), 'QT-2026-0398');
    await userEvent.click(await screen.findByRole('button', { name: 'Plus d’actions, QT-2026-0398' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Annuler la quittance' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.type(within(dialog).getByLabelText('Motif de l’annulation *'), 'Montant erroné');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Annuler la quittance' }));
    expect(await screen.findByText('Quittance annulée le 13/11/2026')).toBeTruthy();
    const paper = screen.getByRole('article', { name: paperName });
    expect(norm(paper.textContent)).toContain('ANNULÉE le 13/11/2026');
    expect(norm(paper.textContent)).toContain('850 €');
  });
});
