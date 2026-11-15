import { DEMO_TODAY } from "@/features/shared/dates";
import { MANDANTS, mandantById } from "@/features/shared/directory";
import { DemoServerError } from "@/features/shared/errors";
import type { Store } from "@/features/shared/store";
import { sum } from "@/features/shared/money";
import { executionDateOf } from "../format";
import { batchMemberSchema, blockSchema, mandantIdSchema, validateLotSchema } from "../inputs";
import type { BatchMemberInput, BlockInput, ValidateLotInput } from "../inputs";
import { CURRENT_PERIOD } from "./model";
import type { FinancesState, ReversementRecord, TransferBatch } from "./model";
import { parseInput } from "./parse";
import { currentBatch, lotView, reversementRow } from "./viewsTransfers";

export interface ValidateLotResult {
  batchId: string;
  transfersCount: number;
  totalMinor: number;
  replayed: boolean;
}

function eligible(state: FinancesState): string[] {
  return MANDANTS.flatMap((mandant) => {
    const row = reversementRow(state, mandant.id);
    return row?.status === "a_reverser" && row.netMinor > 0 ? [mandant.id] : [];
  });
}

function newBatch(mandantIds: string[]): TransferBatch {
  return {
    id: `lot-${CURRENT_PERIOD}`,
    period: CURRENT_PERIOD,
    status: "brouillon",
    mandantIds,
    executionOn: executionDateOf(CURRENT_PERIOD),
    validatedAt: null,
    idempotencyKey: null,
  };
}

function requireDraft(state: FinancesState, batchId: string): TransferBatch {
  const batch = state.batches.find((item) => item.id === batchId);
  if (!batch) throw new DemoServerError("lot_inconnu", "Ce lot de virements n'existe pas.");
  if (batch.status === "valide") throw new DemoServerError("lot_deja_valide", "Ce lot a déjà été transmis à la banque.");
  return batch;
}

function replaceBatch(state: FinancesState, batch: TransferBatch): FinancesState {
  return { ...state, batches: state.batches.map((item) => (item.id === batch.id ? batch : item)) };
}

export function transferCommands(store: Store<FinancesState>) {
  const processed = new Map<string, ValidateLotResult>();

  function prepareLot(): void {
    if (currentBatch(store.get())) return;
    store.update((state) => ({ ...state, batches: [...state.batches, newBatch(eligible(state))] }));
  }

  function includeInLot(input: { mandantId: string }): void {
    const { mandantId } = parseInput(mandantIdSchema, input);
    const state = store.get();
    const row = reversementRow(state, mandantId);
    if (!row) throw new DemoServerError("mandant_inconnu", "Ce mandant n'existe pas.");
    if (row.status === "bloque") throw new DemoServerError("reversement_bloque", `Le reversement est bloqué : ${row.blockedReason ?? "motif non renseigné"}.`);
    if (row.status === "reverse") throw new DemoServerError("deja_reverse", "Ce mandant a déjà été reversé pour cette période.");
    if (row.netMinor <= 0) throw new DemoServerError("rien_a_reverser", "Aucun encaissement à reverser pour ce mandant.");
    const batch = currentBatch(state);
    if (!batch) {
      store.update((current) => ({ ...current, batches: [...current.batches, newBatch([mandantId])] }));
      return;
    }
    const draft = requireDraft(state, batch.id);
    if (draft.mandantIds.includes(mandantId)) return;
    store.update((current) => replaceBatch(current, { ...draft, mandantIds: [...draft.mandantIds, mandantId] }));
  }

  function removeFromLot(input: BatchMemberInput): void {
    const { batchId, mandantId } = parseInput(batchMemberSchema, input);
    const draft = requireDraft(store.get(), batchId);
    store.update((state) => replaceBatch(state, { ...draft, mandantIds: draft.mandantIds.filter((id) => id !== mandantId) }));
  }

  function validateLot(input: ValidateLotInput): ValidateLotResult {
    const { batchId, idempotencyKey } = parseInput(validateLotSchema, input);
    const replay = processed.get(idempotencyKey);
    if (replay) return { ...replay, replayed: true };
    const draft = requireDraft(store.get(), batchId);
    const view = lotView(store.get());
    if (!view || view.transfers.length === 0) throw new DemoServerError("lot_vide", "Le lot ne contient aucun virement à transmettre.");
    const records: ReversementRecord[] = view.transfers.flatMap((transfer) => {
      const row = reversementRow(store.get(), transfer.mandantId);
      return row
        ? [
            {
              id: `rev-${row.mandantId}-${CURRENT_PERIOD}`,
              mandantId: row.mandantId,
              period: CURRENT_PERIOD,
              paidOn: draft.executionOn,
              lots: row.lots,
              collectedMinor: row.collectedMinor,
              feeMinor: row.feeMinor,
              netMinor: row.netMinor,
            },
          ]
        : [];
    });
    store.update((state) => ({
      ...replaceBatch(state, { ...draft, status: "valide", validatedAt: DEMO_TODAY, idempotencyKey }),
      records: [...state.records, ...records],
    }));
    const result: ValidateLotResult = { batchId, transfersCount: records.length, totalMinor: sum(records.map((record) => record.netMinor)), replayed: false };
    processed.set(idempotencyKey, result);
    return result;
  }

  function blockReversement(input: BlockInput): void {
    const { mandantId, reason } = parseInput(blockSchema, input);
    const row = reversementRow(store.get(), mandantId);
    if (!row || !mandantById(mandantId)) throw new DemoServerError("mandant_inconnu", "Ce mandant n'existe pas.");
    if (row.status === "reverse") throw new DemoServerError("deja_reverse", "Ce mandant a déjà été reversé pour cette période.");
    store.update((state) => ({
      ...state,
      blocks: [...state.blocks.filter((block) => block.mandantId !== mandantId), { mandantId, reason, blockedOn: DEMO_TODAY }],
      batches: state.batches.map((batch) => (batch.status === "brouillon" ? { ...batch, mandantIds: batch.mandantIds.filter((id) => id !== mandantId) } : batch)),
    }));
  }

  function unblockReversement(input: { mandantId: string }): void {
    const { mandantId } = parseInput(mandantIdSchema, input);
    store.update((state) => ({ ...state, blocks: state.blocks.filter((block) => block.mandantId !== mandantId) }));
  }

  return { prepareLot, includeInLot, removeFromLot, validateLot, blockReversement, unblockReversement };
}
