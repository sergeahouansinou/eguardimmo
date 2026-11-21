import type { ApiExercise, ApiExerciseDetail, ApiExpense, ApiKey, ApiStatement, ApiStatementSummary, ApiTerms } from './chargesSchemas';
import type { ChargeKey, Exercise, ExerciseDetail, Expense, Statement, StatementSummary, Term } from '../model';

const FALLBACK_LOCALE = 'fr';

export const toExpense = (api: ApiExpense): Expense => ({
  id: api.id,
  propertyId: api.property_id,
  unitId: api.unit_id,
  kind: api.kind,
  categoryTermId: api.category_term_id,
  payeePartyId: api.payee_party_id,
  payeeLabel: api.payee_label,
  reference: api.reference,
  documentOn: api.document_on,
  serviceFrom: api.service_from,
  serviceTo: api.service_to,
  totalGross: api.total_gross,
  taxAmount: api.tax_amount,
  recoverableAmount: api.recoverable_amount,
  recoverableRubric: api.recoverable_rubric,
  settlement: api.settlement,
  paidOn: api.paid_on,
  mandateId: api.mandate_id,
  mandantPartyId: api.mandant_party_id,
  status: api.status,
  cancelReason: api.cancel_reason,
  posted: api.posted,
  files: api.files,
  lockVersion: api.lock_version,
  createdAt: api.created_at,
});

export const toKey = (api: ApiKey): ChargeKey => ({
  id: api.id,
  propertyId: api.property_id,
  label: api.label,
  kind: api.kind,
  archived: api.archived,
  lockVersion: api.lock_version,
  versions: api.versions.map((version) => ({
    id: version.id,
    validFrom: version.valid_from,
    validTo: version.valid_to,
    shares: version.shares.map((share) => ({ unitId: share.unit_id, weight: share.weight })),
  })),
});

export const toExercise = (api: ApiExercise): Exercise => ({
  id: api.id,
  propertyId: api.property_id,
  periodStart: api.period_start,
  periodEnd: api.period_end,
  status: api.status,
  jurisdiction: api.jurisdiction,
  onlyLeaseId: api.only_lease_id,
  prescriptionAcknowledged: api.prescription_acknowledged,
  computedAt: api.computed_at,
  issuedAt: api.issued_at,
  lockVersion: api.lock_version,
});

export const toStatementSummary = (api: ApiStatementSummary): StatementSummary => ({
  id: api.id,
  exerciseId: api.exercise_id,
  leaseId: api.lease_id,
  number: api.number,
  status: api.status,
  occupiedDays: api.occupied_days,
  shareTotal: api.share_total,
  provisionsCalled: api.provisions_called,
  provisionsUnpaid: api.provisions_unpaid,
  balance: api.balance,
  suggestedMonthlyProvision: api.suggested_monthly_provision,
  settlement: api.settlement,
  notBefore: api.not_before,
  issuedAt: api.issued_at,
  supersedesId: api.supersedes_id,
  failureReason: api.failure_reason,
  lockVersion: api.lock_version,
});

export const toExerciseDetail = (api: ApiExerciseDetail): ExerciseDetail => ({
  ...toExercise(api),
  items: api.items.map((item) => ({
    id: item.id,
    label: item.label,
    rubric: item.rubric,
    keyId: item.key_id,
    unitId: item.unit_id,
    position: item.position,
    amount: item.amount,
    ownerShare: item.owner_share,
    sources: item.sources,
    consumptions: item.consumptions.map((consumption) => ({ unitId: consumption.unit_id, quantityMilli: consumption.quantity_milli })),
  })),
  statements: api.statements.map(toStatementSummary),
  excludedLeases: (api.excluded_leases ?? []).map((lease) => ({ leaseId: lease.lease_id, reason: lease.reason })),
});

export const toStatement = (api: ApiStatement): Statement => ({
  ...toStatementSummary(api),
  plan: api.plan === null ? null : { id: api.plan.id, reason: api.plan.reason, recordedAt: api.plan.recorded_at },
  lines: api.lines.map((line) => ({
    itemId: line.item_id,
    label: line.label,
    rubric: line.rubric,
    splitLabel: line.split_label,
    itemAmount: line.item_amount,
    weight: line.weight,
    denominator: line.denominator,
    days: line.days,
    share: line.share,
  })),
  files: api.files.map((file) => ({ id: file.id, label: file.label, tenantVisible: file.tenant_visible, visibleUntil: file.visible_until })),
});

export const toTerm = (api: ApiTerms['data'][number]): Term => ({
  id: api.id,
  key: api.key,
  label: api.labels[FALLBACK_LOCALE] ?? Object.values(api.labels)[0] ?? api.key,
  semanticKey: api.semantic_key,
  recoverableByDefault: api.metadata?.recoverable_by_default === true,
});
