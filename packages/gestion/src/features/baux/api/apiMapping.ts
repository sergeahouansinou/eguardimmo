import { addDays, addMonths, todayIso } from '../../locataires/kit/dates';
import type { Lease, LeaseExit, LeaseStatus, PaymentMethod } from '../schemas';
import { BauxApiError, unexpectedResponse, unsupported } from './apiErrors';
import type { ApiLease, ApiLeasePhase, ApiOccupancyEntry, ApiPaymentMethod, ApiRegime, ApiTerm } from './apiSchemas';

export const FURNISHED_REGIMES: readonly string[] = ['fr.residential.furnished', 'fr.residential.mobility'];
export const REGIME_BY_FURNISHED = { furnished: 'fr.residential.furnished', unfurnished: 'fr.residential.unfurnished' } as const;

const REGIME_LABELS: Readonly<Record<string, string>> = {
  'fr.residential.furnished': 'Logement meublé (loi du 6 juillet 1989)',
  'fr.residential.unfurnished': 'Logement vide (loi du 6 juillet 1989)',
  'fr.residential.mobility': 'Bail mobilité (loi du 6 juillet 1989)',
  'fr.common_law': 'Droit commun (parking ou garage seul)',
};

const STATUS_BY_PHASE: Readonly<Record<ApiLeasePhase, LeaseStatus>> = {
  draft: 'brouillon',
  upcoming: 'a_venir',
  running: 'en_cours',
  notice: 'preavis',
  ended: 'termine',
};

export const PHASE_BY_STATUS: Readonly<Record<LeaseStatus, ApiLeasePhase>> = {
  brouillon: 'draft',
  a_venir: 'upcoming',
  en_cours: 'running',
  preavis: 'notice',
  termine: 'ended',
};

const PAYMENT_FROM_API: Readonly<Record<ApiPaymentMethod, PaymentMethod>> = {
  transfer: 'virement',
  direct_debit: 'prelevement',
  card: 'carte',
  cheque: 'cheque',
  cash: 'especes',
};

const PAYMENT_TO_API: Readonly<Record<PaymentMethod, ApiPaymentMethod>> = {
  virement: 'transfer',
  prelevement: 'direct_debit',
  carte: 'card',
  cheque: 'cheque',
  especes: 'cash',
};

export const paymentToApi = (method: PaymentMethod): ApiPaymentMethod => PAYMENT_TO_API[method];

export const TERM_GROUPS = {
  rent: { primary: 'rent', secondary: ['rent_supplement'] },
  charges: { primary: 'charges_provision', secondary: ['charges_flat'] },
  deposit: { primary: 'deposit', secondary: [] },
} as const;

export type TermGroup = keyof typeof TERM_GROUPS;

const semanticOf = (term: ApiTerm): string | null => term.component.semantic_key ?? null;
export const inGroup = (term: ApiTerm, group: TermGroup): boolean => {
  const semantic = semanticOf(term);
  return semantic !== null && (semantic === TERM_GROUPS[group].primary || (TERM_GROUPS[group].secondary as readonly string[]).includes(semantic));
};

export function assertEuro(currency: string): void {
  if (currency !== 'EUR') throw unsupported('Seuls les baux en euros sont pris en charge par ces écrans.');
}

/**
 * Les lignes en vigueur aujourd'hui ; à défaut (bail terminé), celles de la dernière période connue.
 */
export function currentTerms(terms: readonly ApiTerm[], group: TermGroup): ApiTerm[] {
  const candidates = terms.filter((term) => inGroup(term, group));
  const inForce = candidates.filter((term) => term.in_force);
  if (inForce.length > 0) return inForce;
  const latest = candidates.reduce((max, term) => (term.valid_from > max ? term.valid_from : max), '');
  return candidates.filter((term) => term.valid_from === latest);
}

export function groupAmount(terms: readonly ApiTerm[], group: TermGroup): number {
  return currentTerms(terms, group).reduce((sum, term) => {
    assertEuro(term.amount.currency);
    return sum + term.amount.amount;
  }, 0);
}

export function secondaryAmount(terms: readonly ApiTerm[], group: TermGroup): number {
  return currentTerms(terms, group)
    .filter((term) => semanticOf(term) !== TERM_GROUPS[group].primary)
    .reduce((sum, term) => sum + term.amount.amount, 0);
}

export const monthOf = (isoDate: string): string => isoDate.slice(0, 7);

function guarantorsOf(lease: ApiLease): string | null {
  const names = lease.parties.filter((line) => line.role === 'guarantor' && line.end_date === null).map((line) => line.party.display_name);
  return names.length > 0 ? names.join(', ') : null;
}

function revisionIndexOf(data: Readonly<Record<string, unknown>>): string {
  const index = data.revision_index;
  return typeof index === 'string' ? index.toUpperCase() : '';
}

const MONTHS_PER_YEAR = 12;

/**
 * Les régimes ouverts aujourd'hui (loi du 6 juillet 1989, droit commun) révisent un loyer indexé à la date anniversaire du bail.
 */
function nextRevisionOf(api: ApiLease, today: string): string | null {
  if (api.phase === 'ended' || api.phase === 'draft') return null;
  const indexed = currentTerms(api.terms, 'rent').some((term) => term.indexed);
  if (!indexed) return null;
  let next = addMonths(api.starts_on, MONTHS_PER_YEAR);
  while (next <= today) next = addMonths(next, MONTHS_PER_YEAR);
  return api.end_date !== null && next > api.end_date ? null : next;
}

interface LeaseAmounts {
  end: string;
  rent: number;
  charges: number;
  deposit: number;
  nextRevision: string | null;
  unsupported?: string;
}

function composeLease(api: ApiLease, amounts: LeaseAmounts): Lease {
  const unitId = api.main_unit?.id ?? api.units[0]?.unit.id;
  if (unitId === undefined) throw unexpectedResponse(`bail ${api.reference} sans lot`);
  return {
    id: api.id,
    reference: api.reference,
    unitId,
    tenantIds: api.tenants.map((tenant) => tenant.id),
    furnished: FURNISHED_REGIMES.includes(api.regime_key),
    durationMonths: api.duration_months ?? 1,
    legalNote: REGIME_LABELS[api.regime_key] ?? api.regime_key,
    start: api.starts_on,
    end: amounts.end,
    rent: amounts.rent,
    charges: amounts.charges,
    deposit: amounts.deposit,
    depositReceivedOn: null,
    dueDay: api.due_day,
    paymentMethod: api.payment_method === null ? 'virement' : PAYMENT_FROM_API[api.payment_method],
    revisionIndex: revisionIndexOf(api.jurisdiction_data),
    nextRevision: amounts.nextRevision,
    revisionNote: '',
    rentControl: api.jurisdiction_data.rent_control === true ? 'Encadrement des loyers applicable' : '',
    guarantor: guarantorsOf(api),
    tacitNote: api.tacit_renewal ? 'Reconduction tacite' : 'Sans reconduction tacite',
    status: STATUS_BY_PHASE[api.phase],
    balance: 0,
    note: api.note ?? '',
    archived: api.archived_at !== null,
    ...(amounts.unsupported === undefined ? {} : { unsupported: amounts.unsupported }),
  };
}

export function toLease(api: ApiLease, today: string = todayIso()): Lease {
  assertEuro(api.currency);
  if (api.duration_months === null) {
    throw unsupported(`Le bail ${api.reference} n’a pas de terme : les baux sans fin ne sont pas pris en charge par ces écrans.`);
  }
  return composeLease(api, {
    end: api.end_date ?? addDays(addMonths(api.starts_on, api.duration_months), -1),
    rent: groupAmount(api.terms, 'rent'),
    charges: groupAmount(api.terms, 'charges'),
    deposit: groupAmount(api.terms, 'deposit'),
    nextRevision: nextRevisionOf(api, today),
  });
}

/**
 * Une ligne de liste que ces écrans ne savent pas montrer (autre devise, bail sans terme) devient une ligne « non affichable » :
 * elle n'empêche pas d'afficher les autres baux et ne porte aucun montant inventé.
 */
export function toLeaseRow(api: ApiLease, today: string = todayIso()): Lease {
  try {
    return toLease(api, today);
  } catch (error) {
    if (!(error instanceof BauxApiError) || error.kind !== 'unsupported') throw error;
    return composeLease(api, { end: api.end_date ?? api.starts_on, rent: 0, charges: 0, deposit: 0, nextRevision: null, unsupported: error.message });
  }
}

export function toLeaseExit(api: ApiLease): LeaseExit | null {
  if (api.notice === null) return null;
  const departure = api.notice.departure_on ?? api.end_date;
  if (departure === null) throw unexpectedResponse(`préavis du bail ${api.reference} sans date de départ`);
  return {
    leaseId: api.id,
    noticeReceivedOn: api.notice.received_on,
    noticeKind: api.notice.given_by === 'landlord' ? 'Congé du bailleur' : 'Préavis du locataire',
    noticeDuration: '',
    departure,
    lastInstallment: monthOf(departure),
    reason: api.notice.reason ?? '',
    steps: [],
    repairs: [],
    unpaid: 0,
    chargesRegularisation: 0,
    depositReturned: false,
    attestationId: null,
  };
}

export interface LeaseRegime {
  key: string;
  label: string;
  jurisdiction: string;
  currency: string;
  defaultDurationMonths: number;
  minimumDurationMonths: number;
  maximumDurationMonths: number | null;
  tacitRenewal: boolean;
  renewalMonths: number | null;
  depositCapMonths: number | null;
  tenantNoticeMonths: number | null;
  landlordNoticeMonths: number | null;
  fields: readonly { key: string; type: string; options: readonly string[] }[];
}

export function toRegime(api: ApiRegime): LeaseRegime {
  return {
    key: api.key,
    label: api.label,
    jurisdiction: api.jurisdiction,
    currency: api.currency,
    defaultDurationMonths: api.defaults.duration_months,
    minimumDurationMonths: api.defaults.minimum_duration_months,
    maximumDurationMonths: api.defaults.maximum_duration_months,
    tacitRenewal: api.defaults.tacit_renewal,
    renewalMonths: api.defaults.renewal_months,
    depositCapMonths: api.defaults.deposit_cap_months,
    tenantNoticeMonths: api.defaults.tenant_notice_months,
    landlordNoticeMonths: api.defaults.landlord_notice_months,
    fields: api.jurisdiction_data_fields,
  };
}

export interface UnitOccupancy {
  unitId: string;
  unitReference: string;
  propertyName: string;
  vacant: boolean;
  since: string | null;
  lease: { id: string; reference: string; status: LeaseStatus | null; start: string; end: string | null; tenants: readonly { id: string; name: string }[] } | null;
}

export function toOccupancy(entry: ApiOccupancyEntry): UnitOccupancy {
  return {
    unitId: entry.unit.id,
    unitReference: entry.unit.reference,
    propertyName: entry.unit.property.name,
    vacant: entry.vacant,
    since: entry.since,
    lease:
      entry.lease === null
        ? null
        : {
            id: entry.lease.id,
            reference: entry.lease.reference,
            status: entry.lease.phase === null ? null : STATUS_BY_PHASE[entry.lease.phase],
            start: entry.lease.starts_on,
            end: entry.lease.end_date,
            tenants: entry.lease.tenants.map((tenant) => ({ id: tenant.id, name: tenant.display_name })),
          },
  };
}

export const nextDay = (lastDay: string): string => addDays(lastDay, 1);
