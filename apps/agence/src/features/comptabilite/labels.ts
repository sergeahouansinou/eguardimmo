import type { Journal } from "./schemas";

export const JOURNAL_LABELS: Readonly<Record<Journal, string>> = {
  rent: "Loyers",
  bank: "Banque",
  fees: "Honoraires",
  deposits: "Dépôts de garantie",
  recovery: "Recouvrement",
  adjustments: "Rectifications",
  purchases: "Achats",
};

const ACCOUNT_ROLE_LABELS: Readonly<Record<string, string>> = {
  bank: "Banque",
  cash: "Caisse",
  tenant_receivable: "Créances locataires",
  owner_payable: "Dettes envers les propriétaires et mandants",
  security_deposits: "Dépôts de garantie reçus",
  vat_collected: "TVA collectée",
  rent_revenue: "Produits de loyers",
  charges_recovered: "Charges récupérées",
  fee_revenue: "Honoraires",
  collection_fees: "Frais de recouvrement",
  expenses: "Charges",
  customer_receivable: "Clients",
  vat_deferred: "TVA à exigibilité différée",
  supplier_payable: "Fournisseurs",
  works_pending: "Travaux à imputer",
  trust_bank: "Banque, compte de tiers",
  owner_rent_called: "Loyers appelés pour les mandants",
  owner_charges_called: "Charges appelées pour les mandants",
  owner_vat_called: "TVA appelée pour les mandants",
  payouts_in_transit: "Reversements validés, non exécutés",
  bank_charges: "Frais bancaires",
};

const SOURCE_LABELS: Readonly<Record<string, string>> = {
  installment: "Échéance de loyer",
  payment: "Paiement",
  invoice: "Facture",
  credit_note: "Avoir",
  deposit: "Dépôt de garantie",
  recovery_fee: "Frais de recouvrement",
  adjustment: "Rectification",
  journal_entry: "Écriture manuelle",
  supplier_invoice: "Facture fournisseur",
  supplier_allocation: "Imputation fournisseur",
  supplier_payment: "Paiement fournisseur",
  owner_payout: "Reversement au propriétaire",
  fee_settlement: "Règlement d’honoraires",
  trust_transfer: "Virement entre comptes de tiers",
  expense: "Dépense",
  charge_statement: "Décompte de charges",
  bank_line: "Ligne de relevé bancaire",
};

export const accountRoleLabel = (role: string): string => ACCOUNT_ROLE_LABELS[role] ?? role;
export const sourceLabel = (type: string): string => SOURCE_LABELS[type] ?? type;
export const SIDE_LABELS = { debit: "Débit", credit: "Crédit" } as const;
