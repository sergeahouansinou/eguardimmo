import { formatDateFr, monthLabel, todayIso } from '../locataires/kit/dates';
import { money } from '../locataires/kit/money';
import { tenantNameOf, unitFullLabel } from '../locataires/schemas';
import type { Tenant, Unit } from '../locataires/schemas';
import type { Lease } from '../baux/schemas';
import { BAILLEUR } from './DocumentViewer';

export function templateValues({ tenant, unit, lease }: { tenant: Tenant | undefined; unit: Unit | undefined; lease: Lease | undefined }): Record<string, string> {
  const today = todayIso();
  const next = `${today.slice(0, 7)}-01`;
  return {
    locataire: tenant ? tenantNameOf(tenant) : '',
    civilite: tenant?.civility ?? '',
    bien: unit ? unitFullLabel(unit) : '',
    adresse: tenant?.address && tenant.address !== '' ? tenant.address : `${BAILLEUR.address}, ${BAILLEUR.city}`,
    reference_bail: lease?.reference ?? '',
    loyer: lease ? money(lease.rent + lease.charges) : '',
    'bail.loyer': lease ? money(lease.rent) : '',
    'bail.charges': lease ? money(lease.charges) : '',
    montant_impaye: lease ? money(lease.balance < 0 ? -lease.balance : 0) : '',
    mois: monthLabel(today.slice(0, 7)),
    echeance: formatDateFr(next),
    date: formatDateFr(today),
    bailleur: BAILLEUR.name,
  };
}

export function activeLeaseOf(leases: readonly Lease[], tenantId: string): Lease | undefined {
  return leases.find((lease) => lease.tenantIds.includes(tenantId) && (lease.status === 'en_cours' || lease.status === 'preavis'));
}
