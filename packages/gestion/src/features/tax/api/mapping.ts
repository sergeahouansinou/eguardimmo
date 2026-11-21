import type { GenerationResult, TaxIncome, TaxLine, TaxSummary } from '../model';
import type { ApiSummary, ApiTaxIncome } from './schemas';

const toLine = (line: ApiTaxIncome['totals'][number]): TaxLine => ({
  code: line.code,
  label: line.label,
  status: line.status,
  exact: line.exact,
  rounded: line.rounded,
  sources: line.sources.map((source) => ({ kind: source.kind, ref: source.ref, amount: source.amount })),
  sourcesTruncated: line.sources_truncated,
});

export const toTaxIncome = (api: ApiTaxIncome): TaxIncome => ({
  incomeYear: api.income_year,
  formVersion: api.form_version,
  currency: api.currency,
  provisional: api.provisional,
  householdComplete: api.household_complete,
  properties: api.properties.map((property) => ({
    propertyId: property.property_id,
    name: property.name,
    premises: property.premises,
    coOwners: property.co_owners.map((owner) => ({ shareBp: owner.share_bp, nature: owner.nature })),
    lines: property.lines.map(toLine),
  })),
  totals: api.totals.map(toLine),
  micro: {
    grossReceipts: api.micro.gross_receipts,
    allowanceBp: api.micro.allowance_bp,
    baseAfterAllowance: api.micro.base_after_allowance,
    threshold: api.micro.threshold,
    realBase: api.micro.real_base,
  },
  deficit:
    api.deficit === null
      ? null
      : {
          result: api.deficit.result,
          interestPart: api.deficit.interest_part,
          otherPart: api.deficit.other_part,
          imputableOnGlobalIncome: api.deficit.imputable_on_global_income,
          carriedForward: api.deficit.carried_forward,
        },
  warnings: api.warnings.map((warning) => ({ code: warning.code, propertyId: warning.property_id, message: warning.message })),
  warning: api.warning,
  mentions: api.mentions,
  blockers: (api.blockers ?? []).map((blocker) => ({ code: blocker.code, propertyId: blocker.property_id })),
});

export const toSummary = (api: ApiSummary): TaxSummary => ({
  id: api.id,
  scope: api.scope,
  mandantPartyId: api.mandant_party_id,
  incomeYear: api.income_year,
  formVersion: api.form_version,
  status: api.status,
  currency: api.currency,
  templateVersion: api.template_version,
  supersedesId: api.supersedes_id,
  rectificationReason: api.rectification_reason,
  hasPdf: api.has_pdf,
  publishedAt: api.published_at,
  lockVersion: api.lock_version,
  createdAt: api.created_at,
  totals: api.totals ?? [],
  income: api.income === undefined ? null : toTaxIncome(api.income),
});

export const toGeneration = (api: { mandant_id: string; outcome: GenerationResult['outcome']; statement: ApiSummary | null; error: GenerationResult['error'] }): GenerationResult => ({
  mandantId: api.mandant_id,
  outcome: api.outcome,
  statement: api.statement === null ? null : toSummary(api.statement),
  error: api.error,
});
