'use client';

import { createCollection, NotFoundError } from './kit/collection';
import { todayIso } from './kit/dates';
import { uniqueSlug } from './kit/ids';
import { createSourceContext } from './kit/sourceContext';
import { demoCandidates, demoLeaseTerms, demoTenantDetails, demoTenants, demoUnits } from './demo';
import { candidateInviteSchema, candidateStatusSchema, tenantInputSchema, tenantInviteSchema, tenantNameOf } from './schemas';
import type { CandidateStatus, Tenant, TenantDetail } from './schemas';

export interface LocatairesSource {
  units: () => Promise<unknown>;
  tenants: () => Promise<unknown>;
  tenantDetail: (id: string) => Promise<unknown>;
  createTenant: (input: unknown) => Promise<unknown>;
  updateTenant: (id: string, input: unknown) => Promise<unknown>;
  setTenantArchived: (id: string, archived: boolean) => Promise<unknown>;
  deleteTenant: (id: string) => Promise<void>;
  inviteTenant: (input: unknown) => Promise<unknown>;
  invitePortal: (id: string) => Promise<unknown>;
  candidates: () => Promise<unknown>;
  inviteCandidate: (input: unknown) => Promise<unknown>;
  setCandidateStatus: (id: string, status: CandidateStatus) => Promise<unknown>;
  convertCandidate: (id: string) => Promise<unknown>;
  assignTenantUnit: (tenantIds: readonly string[], unitId: string) => Promise<void>;
  releaseUnit: (unitId: string, archiveTenantIds: readonly string[]) => Promise<void>;
}


function genericDetail(tenant: Tenant): TenantDetail {
  const terms = tenant.unitId ? demoLeaseTerms[tenant.unitId] : undefined;
  const rent = terms ? terms.rent + terms.charges : 0;
  return {
    tenantId: tenant.id,
    rent,
    nextNoticeOn: terms ? '2026-11-25' : null,
    leaseEnd: terms?.end ?? null,
    onTime: { onTime: 0, total: 0 },
    dueSince: null,
    lateSettled: 0,
    payments: terms
      ? [
          { id: 'echeance-2026-10', date: '2026-10-03', label: 'Échéance d’octobre', amount: rent, status: 'paye' },
          { id: 'echeance-2026-09', date: '2026-09-02', label: 'Échéance de septembre', amount: rent, status: 'paye' },
        ]
      : [],
    paymentsCount: terms ? 2 : 0,
    activities: [],
    activitiesCount: 0,
    documents: [],
    documentsCount: 0,
    leases: tenant.unitId && terms
      ? [{ id: tenant.unitId, tone: 'success', title: tenant.unitId, detail: `${terms.start} → ${terms.end}`, badge: { label: 'En cours', tone: 'success' }, href: `/baux/${tenant.unitId}` }]
      : [],
    messages: [],
    messagesCount: 0,
  };
}

export function createDemoLocatairesSource(): LocatairesSource {
  const tenants = createCollection('Locataire', demoTenants);
  const candidates = createCollection('Candidat', demoCandidates);
  const units = createCollection('Bien', demoUnits);
  const unitLabel = (unitId: string) => demoUnits.find((unit) => unit.id === unitId)?.label ?? unitId;

  const requireTenant = (id: string): Tenant => {
    const found = tenants.find(id);
    if (!found) throw new NotFoundError('Locataire', id);
    return found;
  };

  return {
    units: () => Promise.resolve(units.all()),
    tenants: () => Promise.resolve(tenants.all()),
    tenantDetail: (id) => {
      const tenant = tenants.find(id);
      if (!tenant) return Promise.resolve(null);
      const known = demoTenantDetails[id];
      const detail = known ? { ...known } : genericDetail(tenant);
      if (tenant.unitId && !known) {
        const label = unitLabel(tenant.unitId);
        detail.leases = detail.leases.map((lease) => ({ ...lease, title: label }));
      }
      return Promise.resolve(detail);
    },
    createTenant: (input) => {
      const values = tenantInputSchema.parse(input);
      const name = tenantNameOf({ kind: values.kind, firstName: values.firstName, lastName: values.lastName, companyName: values.companyName });
      const id = uniqueSlug(name, tenants.all().map((tenant) => tenant.id));
      return Promise.resolve(
        tenants.add({
          id,
          kind: values.kind,
          civility: values.civility,
          firstName: values.firstName,
          lastName: values.lastName,
          companyName: values.companyName,
          phone: values.phone,
          email: values.email,
          address: '',
          profession: '',
          birthDate: values.birthDate === '' ? null : values.birthDate,
          idDocType: values.idDocType === '' ? null : values.idDocType,
          idExpiry: values.idExpiry === '' ? null : values.idExpiry,
          idFileName: values.idFileName === '' ? null : values.idFileName,
          ibanLast4: null,
          since: todayIso(),
          unitId: null,
          status: 'actif',
          state: 'a_jour',
          balance: 0,
          portalActive: false,
          portalInvitedOn: null,
          lateSince: null,
        }),
      );
    },
    updateTenant: (id, input) => {
      requireTenant(id);
      const values = tenantInputSchema.parse(input);
      return Promise.resolve(
        tenants.patch(id, {
          kind: values.kind,
          civility: values.civility,
          firstName: values.firstName,
          lastName: values.lastName,
          companyName: values.companyName,
          phone: values.phone,
          email: values.email,
          birthDate: values.birthDate === '' ? null : values.birthDate,
          idDocType: values.idDocType === '' ? null : values.idDocType,
          idExpiry: values.idExpiry === '' ? null : values.idExpiry,
          idFileName: values.idFileName === '' ? null : values.idFileName,
        }),
      );
    },
    setTenantArchived: (id, archived) => {
      const tenant = requireTenant(id);
      if (archived && tenant.balance !== 0) {
        return Promise.reject(new Error('Archivage impossible : le compte du locataire n’est pas soldé.'));
      }
      return Promise.resolve(tenants.patch(id, { status: archived ? 'archive' : 'actif', portalActive: archived ? false : tenant.portalActive }));
    },
    deleteTenant: (id) => {
      const tenant = requireTenant(id);
      if (tenant.status !== 'invite') {
        return Promise.reject(new Error('Suppression impossible : ce locataire a un historique. Archivez-le plutôt.'));
      }
      tenants.remove(id);
      return Promise.resolve();
    },
    inviteTenant: (input) => {
      const values = tenantInviteSchema.parse(input);
      const name = `${values.firstName} ${values.lastName}`;
      const id = uniqueSlug(name, tenants.all().map((tenant) => tenant.id));
      return Promise.resolve(
        tenants.add({
          id,
          kind: 'particulier',
          civility: '',
          firstName: values.firstName,
          lastName: values.lastName,
          companyName: '',
          phone: '',
          email: values.email,
          address: '',
          profession: '',
          birthDate: null,
          idDocType: null,
          idExpiry: null,
          idFileName: null,
          ibanLast4: null,
          since: todayIso(),
          unitId: values.unitId === '' ? null : values.unitId,
          status: 'invite',
          state: 'invitation',
          balance: 0,
          portalActive: false,
          portalInvitedOn: null,
          lateSince: null,
        }),
      );
    },
    invitePortal: (id) => {
      const tenant = requireTenant(id);
      if (tenant.portalActive) return Promise.reject(new Error('Ce locataire a déjà accès à son espace.'));
      return Promise.resolve(tenants.patch(id, { portalInvitedOn: todayIso() }));
    },
    assignTenantUnit: (tenantIds, unitId) => {
      if (!units.find(unitId)) return Promise.reject(new NotFoundError('Bien', unitId));
      for (const tenantId of tenantIds) {
        const tenant = requireTenant(tenantId);
        tenants.patch(tenantId, { unitId, status: tenant.status === 'invite' ? 'actif' : tenant.status, state: tenant.status === 'invite' ? 'a_jour' : tenant.state });
      }
      units.patch(unitId, { vacant: false });
      return Promise.resolve();
    },
    releaseUnit: (unitId, archiveTenantIds) => {
      if (!units.find(unitId)) return Promise.reject(new NotFoundError('Bien', unitId));
      for (const tenantId of archiveTenantIds) {
        requireTenant(tenantId);
        tenants.patch(tenantId, { unitId: null, status: 'archive', state: 'a_jour', portalActive: false });
      }
      units.patch(unitId, { vacant: true });
      return Promise.resolve();
    },
    candidates: () => Promise.resolve(candidates.all()),
    inviteCandidate: (input) => {
      const values = candidateInviteSchema.parse(input);
      const id = uniqueSlug(`${values.firstName} ${values.lastName}`, candidates.all().map((candidate) => candidate.id));
      return Promise.resolve(
        candidates.add({
          id,
          firstName: values.firstName,
          lastName: values.lastName,
          email: values.email,
          phone: values.phone,
          unitId: values.unitId,
          monthlyIncome: 0,
          receivedOn: todayIso(),
          status: 'en_attente',
          message: values.message,
          requestedDocuments: values.requestedDocuments,
          tenantId: null,
        }),
      );
    },
    setCandidateStatus: (id, status) => Promise.resolve(candidates.patch(id, { status: candidateStatusSchema.parse(status) })),
    convertCandidate: (id) => {
      const candidate = candidates.find(id);
      if (!candidate) return Promise.reject(new NotFoundError('Candidat', id));
      if (candidate.status !== 'confirme') return Promise.reject(new Error('Confirmez le candidat avant de créer son bail.'));
      if (candidate.tenantId) return Promise.resolve(requireTenant(candidate.tenantId));
      const tenantId = uniqueSlug(`${candidate.firstName} ${candidate.lastName}`, tenants.all().map((tenant) => tenant.id));
      const tenant = tenants.add({
        id: tenantId,
        kind: 'particulier',
        civility: '',
        firstName: candidate.firstName,
        lastName: candidate.lastName,
        companyName: '',
        phone: candidate.phone,
        email: candidate.email,
        address: '',
        profession: '',
        birthDate: null,
        idDocType: null,
        idExpiry: null,
        idFileName: null,
        ibanLast4: null,
        since: todayIso(),
        unitId: null,
        status: 'actif',
        state: 'a_jour',
        balance: 0,
        portalActive: false,
        portalInvitedOn: null,
        lateSince: null,
      });
      candidates.patch(id, { tenantId });
      return Promise.resolve(tenant);
    },
  };
}

const context = createSourceContext('locataires', createDemoLocatairesSource);
export const LocatairesSourceProvider = context.SourceProvider;
export const useLocatairesSource = context.useSource;
