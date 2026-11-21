import type { BadgeTone } from '@eguardimmo/ui';
import type { LineStatus, SummaryStatus } from './model';

export const summaryStatusLabel: Record<SummaryStatus, string> = { final: 'Figée', published: 'Publiée', superseded: 'Remplacée' };
export const summaryStatusTone: Record<SummaryStatus, BadgeTone> = { final: 'info', published: 'success', superseded: 'neutral' };

export const lineStatusLabel: Record<LineStatus, string> = {
  computed: 'Calculée',
  proposed: 'Proposée',
  to_complete: 'À compléter',
  conflict: 'Conflit à résoudre',
  total: 'Total',
};
export const lineStatusTone: Record<LineStatus, BadgeTone> = { computed: 'success', proposed: 'info', to_complete: 'warning', conflict: 'danger', total: 'neutral' };

export const blockerLabel: Record<string, string> = {
  interest_source_conflict: 'Un bien a un prêt suivi et une dépense « intérêts d’emprunt » pour cette année : gardez une seule source.',
};

export const coOwnerNatureLabel: Record<string, string> = { full: 'Pleine propriété', bare: 'Nue-propriété', usufruct: 'Usufruit' };

export const sourceKindLabel: Record<string, string> = {
  rent_collected: 'Loyer encaissé',
  advance_collected: 'Provision encaissée',
  expense: 'Dépense',
  declared_expense: 'Dépense déclarée',
  supplier_invoice: 'Facture fournisseur',
  loan_attestation: 'Attestation de la banque',
  loan_schedule: 'Échéancier du prêt',
  co_ownership_statement: 'Relevé de copropriété',
  management_fees: 'Honoraires de gestion',
  flat_fee: 'Forfait de gestion',
};

export const sourceLabel = (kind: string): string => sourceKindLabel[kind] ?? kind;
