import type { Currency } from '../../../format/money';
import { addDays } from '../lib/dates';
import type { OccupationData, Period } from '../schemas/lots';
import { toLeasePeriod, toRentSteps } from './apiMapping';
import type { ApiLeaseDetail, ApiOwnership } from './apiSchemas';

export interface OccupationInput {
  leases: readonly ApiLeaseDetail[];
  ownerships: readonly ApiOwnership[];
  asOf: string;
  currency: Currency;
}

const vacancy = (startDate: string, endDate: string | null): Period => ({
  id: `vacance-${startDate}`,
  kind: 'vacance',
  startDate,
  endDate,
  occupant: null,
  leaseType: null,
  note: null,
  status: null,
  noticeEndsOn: null,
  entryRent: null,
  lastRent: null,
  deposit: null,
  exitNote: null,
});

function vacancies(leasePeriods: readonly Period[], from: string, asOf: string): Period[] {
  const gaps: Period[] = [];
  let cursor: string | null = from;
  for (const period of leasePeriods) {
    if (cursor === null) break;
    if (period.startDate > cursor) gaps.push(vacancy(cursor, addDays(period.startDate, -1)));
    const next: string | null = period.endDate === null ? null : addDays(period.endDate, 1);
    cursor = next === null ? null : next > cursor ? next : cursor;
  }
  if (cursor !== null && cursor <= asOf) gaps.push(vacancy(cursor, null));
  return gaps;
}

export function buildOccupation({ leases, ownerships, asOf, currency }: OccupationInput): OccupationData {
  const leasePeriods = leases.flatMap((lease) => toLeasePeriod(lease) ?? []).sort((a, b) => a.startDate.localeCompare(b.startDate));
  const acquisitions = ownerships.map((ownership) => ownership.valid_from).sort();
  const known = acquisitions[0] ?? leasePeriods[0]?.startDate ?? null;
  const periods = known === null ? [] : [...leasePeriods, ...vacancies(leasePeriods, known, asOf)].sort((a, b) => a.startDate.localeCompare(b.startDate));
  return { currency, asOf, acquisitionDate: known ?? asOf, periods, rentSteps: toRentSteps(leases), inspections: [] };
}
