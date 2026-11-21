export const SOURCE_LABELS: Readonly<Record<string, string>> = {
  installment: "Échéance de loyer",
  payment: "Encaissement",
  invoice: "Facture",
  credit_note: "Avoir",
  deposit: "Dépôt de garantie",
  recovery_fee: "Frais de recouvrement",
  adjustment: "Ajustement",
  journal_entry: "Écriture comptable",
  supplier_invoice: "Facture de prestataire",
  supplier_allocation: "Imputation prestataire",
  supplier_payment: "Règlement de prestataire",
  owner_payout: "Reversement",
  fee_settlement: "Honoraires prélevés",
  trust_transfer: "Virement entre comptes",
  expense: "Dépense",
  charge_statement: "Décompte de charges",
  bank_line: "Mouvement bancaire",
};

export const SOURCE_FALLBACK = "Autre opération";

export const sourceLabel = (source: string): string => SOURCE_LABELS[source] ?? SOURCE_FALLBACK;
