import { createStore } from "@/features/shared/store";
import type { FinancesSource } from "./source";
import { feeCommands } from "./server/commandsFees";
import { paymentCommands } from "./server/commandsPayments";
import { transferCommands } from "./server/commandsTransfers";
import { unpaidCommands } from "./server/commandsUnpaid";
import { createInitialState } from "./server/seed";
import { baremes, honoraires, simulateBareme } from "./server/viewsFees";
import { encaissements, openInstallments, previewPayment, statements } from "./server/viewsPayments";
import { lotView, reversementDetail, reversements } from "./server/viewsTransfers";
import { impayeDetail, impayes } from "./server/viewsUnpaid";

function resolved<T>(run: () => T): Promise<T> {
  try {
    return Promise.resolve(run());
  } catch (error) {
    return Promise.reject(error instanceof Error ? error : new Error(String(error)));
  }
}

export function createFinancesDemo(): FinancesSource {
  const store = createStore(createInitialState());
  const payments = paymentCommands(store);
  const unpaid = unpaidCommands(store);
  const transfers = transferCommands(store);
  const fees = feeCommands(store);
  return {
    statements: (period) => resolved(() => statements(store.get(), period)),
    encaissements: (period) => resolved(() => encaissements(store.get(), period)),
    openInstallments: () => resolved(() => openInstallments(store.get())),
    previewPayment: (input) => resolved(() => previewPayment(store.get(), input)),
    recordPayment: (input) => resolved(() => payments.recordPayment(input)),
    reconcilePayment: (input) => resolved(() => { payments.reconcilePayment(input); }),
    rejectPayment: (input) => resolved(() => { payments.rejectPayment(input); }),
    impayes: () => resolved(() => impayes(store.get())),
    impayeDetail: (lotId) => resolved(() => impayeDetail(store.get(), lotId)),
    sendReminders: (input) => resolved(() => unpaid.sendReminders(input)),
    proposePlan: (input) => resolved(() => { unpaid.proposePlan(input); }),
    prepareNotice: (input) => resolved(() => { unpaid.prepareNotice(input); }),
    informMandant: (input) => resolved(() => { unpaid.informMandant(input); }),
    reversements: () => resolved(() => reversements(store.get())),
    lot: () => resolved(() => lotView(store.get())),
    reversement: (mandantId) => resolved(() => reversementDetail(store.get(), mandantId)),
    prepareLot: () => resolved(() => { transfers.prepareLot(); }),
    includeInLot: (input) => resolved(() => { transfers.includeInLot(input); }),
    removeFromLot: (input) => resolved(() => { transfers.removeFromLot(input); }),
    validateLot: (input) => resolved(() => transfers.validateLot(input)),
    blockReversement: (input) => resolved(() => { transfers.blockReversement(input); }),
    unblockReversement: (input) => resolved(() => { transfers.unblockReversement(input); }),
    honoraires: (period) => resolved(() => honoraires(store.get(), period)),
    baremes: () => resolved(() => baremes(store.get())),
    simulateBareme: (input) => resolved(() => simulateBareme(store.get(), input)),
    saveBareme: (input) => resolved(() => fees.saveBareme(input)),
  };
}
