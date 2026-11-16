import { CURRENCIES } from '../../../format/money';
import type { Currency } from '../../../format/money';
import { formatDateFr } from '../kit/dates';
import type { Tenant, TenantDetail, TenantState, Unit } from '../schemas';
import type { ApiAddress, ApiLeaseDetail, ApiLeasePhase, ApiParty, ApiPartySummary, ApiTenancyLine, ApiUnitRef, IdentifierScheme } from './apiSchemas';

type IdDocType = NonNullable<Tenant['idDocType']>;
type DetailRow = TenantDetail['leases'][number];

export const ID_SCHEME_BY_DOC: Readonly<Record<IdDocType, IdentifierScheme>> = { cni: 'national_id', passeport: 'passport', titre_sejour: 'residence_permit' };
const DOC_BY_SCHEME: Readonly<Partial<Record<IdentifierScheme, IdDocType>>> = { national_id: 'cni', passport: 'passeport', residence_permit: 'titre_sejour' };

export const docTypeOfScheme = (scheme: IdentifierScheme): IdDocType | null => DOC_BY_SCHEME[scheme] ?? null;

const LIVE_PHASES: readonly ApiLeasePhase[] = ['running', 'notice', 'upcoming'];

const PHASE_BADGE: Readonly<Record<ApiLeasePhase, { label: string; tone: DetailRow['tone'] }>> = {
  draft: { label: 'Brouillon', tone: 'neutral' },
  upcoming: { label: 'À venir', tone: 'info' },
  running: { label: 'En cours', tone: 'success' },
  notice: { label: 'Préavis', tone: 'warning' },
  ended: { label: 'Terminé', tone: 'neutral' },
};

const ROLE_LABEL = { tenant: 'Locataire', guarantor: 'Garant', occupant: 'Occupant' } as const;

const isCurrent = (line: ApiTenancyLine, today: string): boolean => line.end_date === null || line.end_date >= today;
const isLive = (line: ApiTenancyLine, today: string): boolean => LIVE_PHASES.includes(line.phase) && isCurrent(line, today);
export const tenantLines = (lines: readonly ApiTenancyLine[]): ApiTenancyLine[] => lines.filter((line) => line.role === 'tenant');

/**
 * Le serveur n'expose pas de filtre « locataire » : une partie sans aucun bail reste proposée (elle servira à un premier bail)
 * sauf si elle porte une catégorie de contact (prestataire, notaire…), une partie qui n'apparaît qu'en garant ou occupant est écartée.
 */
export const isTenantCandidate = (lines: readonly ApiTenancyLine[], isContact = false): boolean =>
  lines.length === 0 ? !isContact : lines.some((line) => line.role === 'tenant');

export function tenantStateOf(lines: readonly ApiTenancyLine[], today: string): TenantState {
  const live = tenantLines(lines).filter((line) => isLive(line, today));
  if (live.some((line) => line.phase === 'notice')) return 'preavis';
  return live.length > 0 ? 'en_cours' : 'sans_bail';
}

export function mainUnitOf(lines: readonly ApiTenancyLine[], today: string): string | null {
  const live = tenantLines(lines).filter((line) => isLive(line, today) && line.main_unit !== null);
  const ranked = [...live].sort((a, b) => LIVE_PHASES.indexOf(a.phase) - LIVE_PHASES.indexOf(b.phase));
  return ranked[0]?.main_unit?.id ?? null;
}

function sinceOf(lines: readonly ApiTenancyLine[]): string {
  return tenantLines(lines).reduce((earliest, line) => (earliest === '' || line.since < earliest ? line.since : earliest), '');
}

export function addressLine(address: ApiAddress | null): string {
  if (address === null) return '';
  const street = [address.line1, address.line2 ?? ''].filter((part) => part !== '').join(', ');
  return [street, `${address.postal_code} ${address.city}`.trim()].filter((part) => part !== '').join(', ');
}

const common = (id: string, kind: 'person' | 'company', archivedAt: string | null, lines: readonly ApiTenancyLine[], today: string) => ({
  id,
  kind: kind === 'company' ? ('societe' as const) : ('particulier' as const),
  civility: '' as const,
  profession: '',
  idExpiry: null,
  idFileName: null,
  since: sinceOf(lines),
  unitId: mainUnitOf(lines, today),
  status: archivedAt === null ? ('actif' as const) : ('archive' as const),
  state: tenantStateOf(lines, today),
  balance: 0,
  portalActive: false,
  portalInvitedOn: null,
  lateSince: null,
});

/**
 * La liste ne porte que le nom d'affichage : il est rangé dans `firstName` (ou `companyName`) pour l'affichage ;
 * la fiche et le formulaire relisent le détail du serveur.
 */
export function toTenantFromSummary(summary: ApiPartySummary, lines: readonly ApiTenancyLine[], today: string): Tenant {
  const company = summary.kind === 'company';
  return {
    ...common(summary.id, summary.kind, summary.archived_at, lines, today),
    firstName: company ? '' : summary.display_name,
    lastName: '',
    companyName: company ? summary.display_name : '',
    phone: summary.primary_phone ?? '',
    email: summary.primary_email ?? '',
    address: '',
    birthDate: null,
    idDocType: null,
    ibanLast4: null,
    idLast4: null,
  };
}

export function primaryValue(party: ApiParty, type: 'email' | 'phone'): string {
  const points = party.contact_points.filter((point) => point.type === type);
  return (points.find((point) => point.is_primary) ?? points[0])?.value ?? '';
}

export function personalIdentifier(party: ApiParty): ApiParty['identifiers'][number] | undefined {
  return party.identifiers.find((identifier) => docTypeOfScheme(identifier.scheme) !== null);
}

export function toTenantFromParty(party: ApiParty, lines: readonly ApiTenancyLine[], today: string): Tenant {
  const identifier = personalIdentifier(party);
  const account = party.bank_accounts.find((entry) => entry.is_active);
  return {
    ...common(party.id, party.kind, party.archived_at, lines, today),
    firstName: party.first_name ?? '',
    lastName: party.last_name ?? '',
    companyName: party.company_name ?? '',
    phone: primaryValue(party, 'phone'),
    email: primaryValue(party, 'email'),
    address: addressLine(party.address),
    birthDate: party.birth_date,
    idDocType: identifier ? docTypeOfScheme(identifier.scheme) : null,
    ibanLast4: account?.iban_last4 ?? null,
    idLast4: identifier?.last4 ?? null,
  };
}

export const toUnit = (unit: ApiUnitRef, vacant: boolean): Unit => ({ id: unit.id, label: unit.reference, building: unit.property.name, vacant });

const unitText = (line: ApiTenancyLine): string => (line.main_unit ? `${line.main_unit.reference}, ${line.main_unit.property.name}` : line.reference);

function leaseRow(line: ApiTenancyLine): DetailRow {
  const badge = PHASE_BADGE[line.phase];
  const period = `${formatDateFr(line.since)} → ${line.end_date === null ? 'sans terme' : formatDateFr(line.end_date)}`;
  const role = line.role === 'tenant' ? '' : `${ROLE_LABEL[line.role]} · `;
  return { id: line.id, tone: badge.tone, title: unitText(line), detail: `${role}${line.reference} · ${period}`, badge, href: `/baux/${line.id}` };
}

const RENT_PARTS = ['rent', 'rent_supplement', 'charges_provision', 'charges_flat'];

export const currencyOf = (code: string): Currency | undefined => CURRENCIES.find((currency) => currency === code);

export function monthlyTotal(lease: ApiLeaseDetail): number {
  if (currencyOf(lease.currency) === undefined) return 0;
  return lease.terms
    .filter((term) => term.in_force && RENT_PARTS.includes(term.component.semantic_key ?? ''))
    .reduce((sum, term) => sum + term.amount.amount, 0);
}

export function currentLine(lines: readonly ApiTenancyLine[], today: string): ApiTenancyLine | undefined {
  const live = tenantLines(lines).filter((line) => isLive(line, today));
  return [...live].sort((a, b) => LIVE_PHASES.indexOf(a.phase) - LIVE_PHASES.indexOf(b.phase))[0];
}

export function toTenantDetail(tenantId: string, lines: readonly ApiTenancyLine[], lease: ApiLeaseDetail | null): TenantDetail {
  const guarantors = (lease?.parties ?? [])
    .filter((entry) => entry.role === 'guarantor' && entry.end_date === null && (entry.guarantees_party_id === null || entry.guarantees_party_id === tenantId))
    .map((entry) => ({ id: entry.id, tone: 'neutral' as const, title: entry.party.display_name, detail: `Garant du bail ${lease?.reference ?? ''}`.trim() }));
  const rentCurrency = lease ? currencyOf(lease.currency) : undefined;
  return {
    tenantId,
    rent: lease ? monthlyTotal(lease) : 0,
    ...(rentCurrency === undefined ? {} : { rentCurrency }),
    nextNoticeOn: null,
    leaseEnd: lease?.end_date ?? null,
    onTime: { onTime: 0, total: 0 },
    dueSince: null,
    lateSettled: 0,
    payments: [],
    paymentsCount: 0,
    activities: [],
    activitiesCount: 0,
    documents: [],
    documentsCount: 0,
    guarantors,
    leases: lines.map(leaseRow),
    messages: [],
    messagesCount: 0,
  };
}

export interface ContactPoint {
  id: string;
  type: 'email' | 'phone';
  value: string;
  label: string | null;
  primary: boolean;
}
export interface Identifier {
  id: string;
  scheme: IdentifierScheme;
  country: string;
  last4: string | null;
}
export interface BankAccount {
  id: string;
  ibanLast4: string;
  bic: string | null;
  holderName: string;
  validFrom: string;
  validTo: string | null;
  active: boolean;
}

export const toContactPoint = (point: ApiParty['contact_points'][number]): ContactPoint => ({ id: point.id, type: point.type, value: point.value, label: point.label, primary: point.is_primary });
/** Le numéro d'une pièce personnelle ne revient jamais du serveur ; on ne garde de toute façon que ses quatre derniers caractères. */
export const toIdentifier = (identifier: ApiParty['identifiers'][number]): Identifier => ({ id: identifier.id, scheme: identifier.scheme, country: identifier.country, last4: identifier.last4 });
export const toBankAccount = (account: ApiParty['bank_accounts'][number]): BankAccount => ({
  id: account.id,
  ibanLast4: account.iban_last4,
  bic: account.bic,
  holderName: account.holder_name,
  validFrom: account.valid_from,
  validTo: account.valid_to,
  active: account.is_active,
});
