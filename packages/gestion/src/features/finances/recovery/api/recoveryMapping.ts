import { CURRENCIES } from '../../../../format/money';
import type { Currency } from '../../../../format/money';
import type { Bundle, CaseItem, CaseSummary, Money, RecoveryAct, RecoveryCase, Transmission, UnpaidItem } from '../model';
import { unexpectedResponse, unsupported } from './recoveryErrors';
import type { ApiAct, ApiBundle, ApiCase, ApiCaseSummary, ApiTransmission, ApiUnpaid } from './recoverySchemas';

const isCurrency = (code: string): code is Currency => CURRENCIES.some((currency) => currency === code);

export function toCurrency(code: string): Currency {
  if (!isCurrency(code)) throw unsupported(`La devise ${code} n’est pas prise en charge par ces écrans (EUR et XOF seulement).`);
  return code;
}

export function toMoney(api: { amount: number; currency: string }): Money {
  return { amount: api.amount, currency: toCurrency(api.currency) };
}

interface ReceivableFields {
  type: 'installment' | 'invoice';
  installment_id: string | null;
  invoice_id: string | null;
  reference: string | null;
  period: { start: string; end: string } | null;
  issued_on: string | null;
}

function checkReceivable(api: ReceivableFields): void {
  if (api.type === 'installment' && (api.installment_id === null || api.period === null)) throw unexpectedResponse('installment');
  if (api.type === 'invoice' && (api.invoice_id === null || api.reference === null || api.issued_on === null)) throw unexpectedResponse('invoice');
}

export function toUnpaid(api: ApiUnpaid): UnpaidItem {
  checkReceivable(api);
  return {
    type: api.type,
    itemId: api.item_id,
    reference: api.reference,
    leaseId: api.lease.id,
    leaseReference: api.lease.reference,
    partyId: api.party?.id ?? null,
    partyName: api.party?.name ?? null,
    periodStart: api.period?.start ?? null,
    periodEnd: api.period?.end ?? null,
    issuedOn: api.issued_on,
    dueDate: api.due_date,
    daysOverdue: api.days_overdue,
    status: api.status,
    total: toMoney(api.total),
    outstanding: toMoney(api.outstanding),
    caseRef: api.case,
  };
}

export function toCaseSummary(api: ApiCaseSummary): CaseSummary {
  return {
    id: api.id,
    number: api.number,
    status: api.status,
    leaseId: api.lease.id,
    leaseReference: api.lease.reference,
    debtorId: api.debtor.id,
    debtorName: api.debtor.name,
    currency: toCurrency(api.currency),
    openedOn: api.opened_on,
    closedOn: api.closed_on,
    statusReason: api.status_reason,
    itemsCount: api.items_count,
    outstanding: toMoney(api.outstanding),
  };
}

const toItem = (item: ApiCase['items'][number]): CaseItem => {
  checkReceivable(item);
  return {
    id: item.id,
    type: item.type,
    itemId: item.item_id,
    reference: item.reference,
    periodStart: item.period?.start ?? null,
    periodEnd: item.period?.end ?? null,
    issuedOn: item.issued_on,
    dueDate: item.due_date,
    total: toMoney(item.total),
    amountDueAtInclusion: toMoney(item.amount_due_at_inclusion),
    outstanding: item.outstanding === null ? null : toMoney(item.outstanding),
    includedAt: item.included_at,
    removedAt: item.removed_at,
  };
};

export function toCase(api: ApiCase): RecoveryCase {
  return {
    ...toCaseSummary(api),
    items: api.items.map(toItem),
    bundles: (api.bundles ?? []).map((bundle) => ({
      id: bundle.id,
      number: bundle.number,
      generatedOn: bundle.generated_on,
      totalDue: toMoney(bundle.total_due),
      piecesCount: bundle.pieces_count,
      transmissionsCount: bundle.transmissions_count,
    })),
  };
}

export function toAct(api: ApiAct): RecoveryAct {
  return {
    id: api.id,
    caseId: api.case_id,
    type: api.type,
    performedOn: api.performed_on,
    authorUserId: api.author_user_id,
    reference: api.reference,
    note: api.note,
    recipientName: api.details?.recipient_name ?? null,
    piecesCount: api.details?.pieces_count ?? null,
    expiresAt: api.details?.expires_at ?? null,
    createdAt: api.created_at,
  };
}

export function toTransmission(api: ApiTransmission): Transmission {
  return {
    id: api.id,
    bundleId: api.bundle_id,
    recipientPartyId: api.recipient.party_id,
    recipientEmail: api.recipient.email,
    state: api.state,
    expiresAt: api.expires_at,
    revokedAt: api.revoked_at,
    sentAt: api.sent_at,
    firstDownloadedAt: api.first_downloaded_at,
    downloadCount: api.download_count,
    replacesId: api.replaces_id,
    createdAt: api.created_at,
  };
}

export function toBundle(api: ApiBundle): Bundle {
  const currency = toCurrency(api.statement.currency);
  return {
    id: api.id,
    caseId: api.case_id,
    number: api.number,
    generatedOn: api.generated_on,
    sizeBytes: api.size_bytes,
    sha256: api.sha256,
    totalDue: toMoney(api.total_due),
    calledTotal: { amount: api.statement.totals.called, currency },
    pieces: api.pieces.map((piece) => ({ kind: piece.kind, label: piece.label, number: piece.number, fileName: piece.file_name, sha256: piece.sha256 })),
    transmissions: (api.transmissions ?? []).map(toTransmission),
  };
}
