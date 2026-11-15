import { NotFoundError, createCollection } from '../locataires/kit/collection';
import { todayIso } from '../locataires/kit/dates';
import { nextSequence } from '../locataires/kit/ids';
import { CURRENT_AUTHOR } from './author';
import { parseOrThrow } from './parse';
import { receiptIdOf } from './paths';
import { receiptFingerprint } from './receiptFingerprint';
import { emissionHistory } from './receiptHistory';
import { receiptCancelInputSchema } from './schemas';
import type { Receipt } from './schemas';
import type { CourriersSource } from './sourceTypes';

type ReceiptsApi = Pick<CourriersSource, 'receipts' | 'emitReceipts' | 'markReceiptSent' | 'cancelReceipt'>;

const pendingIdOf = (month: string, leaseId: string): string => `en-attente-${month.replace('-', '')}-${leaseId}`;

export function createReceiptsSource(initial: readonly Receipt[]): ReceiptsApi {
  const receipts = createCollection('Quittance', initial);
  const year = () => Number(todayIso().slice(0, 4));
  let sealing: Promise<void> | null = null;

  const ready = (): Promise<void> => {
    sealing ??= Promise.all(
      receipts
        .all()
        .filter((receipt) => receipt.number !== null && receipt.fingerprint === null)
        .map(async (receipt) => { receipts.patch(receipt.id, { fingerprint: await receiptFingerprint(receipt) }); }),
    ).then(() => undefined);
    return sealing;
  };

  return {
    receipts: async () => {
      await ready();
      return receipts.all();
    },
    emitReceipts: async (month) => {
      await ready();
      const pending = receipts.all().filter((receipt) => receipt.number === null && receipt.outstanding === 0 && receipt.month === month);
      if (pending.length === 0) throw new Error('Aucune quittance à émettre pour ce mois.');
      const taken = receipts.all().map((receipt) => receipt.number ?? '');
      const today = todayIso();
      const sealed = await Promise.all(
        pending.map(async (receipt) => {
          const number = nextSequence(taken, 'QT', year(), 4);
          taken.push(number);
          const issued = { ...receipt, id: receiptIdOf(number), number, issuedOn: today, sentOn: today, history: emissionHistory(today, today) };
          return { ...issued, fingerprint: await receiptFingerprint(issued) };
        }),
      );
      return pending.map((receipt, index) => {
        receipts.remove(receipt.id);
        return receipts.add(sealed[index] ?? receipt);
      });
    },
    markReceiptSent: async (id) => {
      await ready();
      const current = receipts.find(id);
      if (!current?.number) throw new NotFoundError('Quittance', id);
      if (current.cancellation) throw new Error('Une quittance annulée ne peut pas être envoyée.');
      const today = todayIso();
      return receipts.patch(id, { sentOn: today, history: [...current.history, { type: 'envoyee', on: today, by: CURRENT_AUTHOR, note: null }] });
    },
    cancelReceipt: async (id, raw) => {
      await ready();
      const current = receipts.find(id);
      if (!current) throw new NotFoundError('Quittance', id);
      if (current.number === null) throw new Error('Seule une quittance émise peut être annulée.');
      if (current.cancellation) throw new Error('Cette quittance est déjà annulée.');
      const { reason } = parseOrThrow(receiptCancelInputSchema, raw);
      const today = todayIso();
      const cancelled = receipts.patch(id, {
        cancellation: { on: today, by: CURRENT_AUTHOR, reason },
        history: [...current.history, { type: 'annulee', on: today, by: CURRENT_AUTHOR, note: reason }],
      });
      const reopenedId = pendingIdOf(current.month, current.leaseId);
      const alreadyPending = receipts.all().some((receipt) => receipt.number === null && receipt.leaseId === current.leaseId && receipt.month === current.month);
      if (!alreadyPending && !receipts.find(reopenedId)) {
        receipts.add({
          id: reopenedId,
          number: null,
          leaseId: current.leaseId,
          tenantId: current.tenantId,
          unitId: current.unitId,
          month: current.month,
          rent: current.rent,
          charges: current.charges,
          outstanding: 0,
          issuedOn: null,
          sentOn: null,
          fingerprint: null,
          cancellation: null,
          history: [],
        });
      }
      return cancelled;
    },
  };
}
