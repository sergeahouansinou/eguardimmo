import type { ApiClient } from '@eguardimmo/api';
import { LOCATAIRES_FEATURES } from '../capabilities';
import { todayIso } from '../kit/dates';
import { tenantInputSchema, tenantNameOf } from '../schemas';
import type { Tenant, TenantDetail, TenantInput, Unit } from '../schemas';
import type { LocatairesSource } from '../source';
import { LocatairesApiError, invalid, isTenantStaleVersion, unexpectedResponse, unsupported } from './apiErrors';
import { currentLine, isTenantCandidate, primaryValue, toTenantDetail, toTenantFromParty, toTenantFromSummary, toUnit } from './apiMapping';
import { partyOperations, parseInput } from './apiOperations';
import { createPartyPayload, planIdentifier, updatePartyPayload } from './apiPayloads';
import { fetchAllSummaries, fetchAllUnits, fetchContactIds, fetchLeaseDetail, fetchOrganizationCountry, fetchParty, fetchSummaryPage, fetchTenancies, fetchVacancy, knownParty, partyPath, remember } from './apiReads';
import type { ApiContext, TenantPageQuery } from './apiReads';
import { apiContactPointResponseSchema, apiIdentifierResponseSchema, apiPartyResponseSchema } from './apiSchemas';
import type { ApiParty, ApiPartySummary, ContactPointType } from './apiSchemas';
import { createTransport } from './apiTransport';

export interface ApiLocatairesSourceOptions {
  client: ApiClient;
  organizationId: string | null;
}

export interface ApiLocatairesSourceDependencies {
  now?: () => Date;
}

export interface TenantPage {
  items: Tenant[];
  nextCursor: string | null;
}

export type ApiLocatairesSource = LocatairesSource &
  ReturnType<typeof partyOperations> & {
    tenantPage: (query?: TenantPageQuery) => Promise<TenantPage>;
    anonymizeTenant: (id: string) => Promise<Tenant>;
  };

const ID_NUMBER_REQUIRED = 'Indiquez le numéro de la pièce d’identité.';
const KIND_LOCKED = 'Le type du locataire (particulier ou société) ne peut plus changer après sa création.';
const noRoute = (what: string) => (): Promise<never> => Promise.reject(unsupported(`${what} : cette fonction n’est pas encore reliée au serveur.`));

export function createApiLocatairesSource({ client, organizationId }: ApiLocatairesSourceOptions, { now = () => new Date() }: ApiLocatairesSourceDependencies = {}): ApiLocatairesSource {
  const transport = createTransport(client, organizationId);
  const context: ApiContext = { transport, latest: new Map(), today: () => todayIso(now()) };
  const operations = partyOperations(context);
  let inflight: Promise<Tenant[]> | null = null;
  let country: Promise<string> | null = null;

  const organizationCountry = (): Promise<string> => {
    country ??= fetchOrganizationCountry(context).catch((error: unknown) => {
      country = null;
      throw error;
    });
    return country;
  };

  const fromSummaries = async (items: readonly ApiPartySummary[]): Promise<Tenant[]> => {
    const lines = await fetchTenancies(context, items.map((item) => item.id));
    const withoutLease = items.some((item) => (lines.get(item.id) ?? []).length === 0);
    const contacts = withoutLease ? await fetchContactIds(context) : new Set<string>();
    return items
      .filter((item) => isTenantCandidate(lines.get(item.id) ?? [], contacts.has(item.id)))
      .map((item) => toTenantFromSummary(item, lines.get(item.id) ?? [], context.today()));
  };

  const fromParty = async (party: ApiParty): Promise<Tenant> => toTenantFromParty(party, (await fetchTenancies(context, [party.id])).get(party.id) ?? [], context.today());

  const tenantPage = async (query: TenantPageQuery = {}): Promise<TenantPage> => {
    const { items, nextCursor } = await fetchSummaryPage(context, query);
    return { items: await fromSummaries(items), nextCursor };
  };

  const tenants = (): Promise<Tenant[]> => {
    inflight ??= fetchAllSummaries(context, { status: 'all' })
      .then(fromSummaries)
      .finally(() => {
        inflight = null;
      });
    return inflight;
  };

  const tenant = async (id: string): Promise<Tenant | null> => {
    try {
      return await fromParty(await fetchParty(context, id));
    } catch (error) {
      if (error instanceof LocatairesApiError && error.kind === 'not_found') return null;
      throw error;
    }
  };

  const requireTenant = async (id: string): Promise<Tenant> => {
    const found = await tenant(id);
    if (found === null) throw unexpectedResponse('locataire introuvable après enregistrement');
    return found;
  };

  const tenantDetail = async (id: string): Promise<TenantDetail | null> => {
    let lines;
    try {
      lines = (await fetchTenancies(context, [id])).get(id) ?? [];
    } catch (error) {
      if (error instanceof LocatairesApiError && error.kind === 'not_found') return null;
      throw error;
    }
    const current = currentLine(lines, context.today());
    return toTenantDetail(id, lines, current ? await fetchLeaseDetail(context, current.id) : null);
  };

  const units = async (): Promise<Unit[]> => {
    const all = await fetchAllUnits(context);
    const vacancy = await fetchVacancy(context, all.map((unit) => unit.id));
    return all.map((unit) => toUnit(unit, vacancy.get(unit.id) ?? false));
  };

  const partial = (party: ApiParty, values: TenantInput, error: unknown): unknown => {
    context.latest.delete(party.id);
    if (!(error instanceof LocatairesApiError)) return error;
    return new LocatairesApiError(error.kind, `La fiche de ${tenantNameOf(values)} est enregistrée mais une coordonnée ou une pièce n’a pas pu l’être : ${error.message}`, {
      status: error.status ?? undefined,
      code: error.code,
      fieldErrors: error.fieldErrors,
      cause: error,
    });
  };

  const syncContact = async (party: ApiParty, type: ContactPointType, value: string): Promise<void> => {
    const points = party.contact_points.filter((point) => point.type === type);
    const primary = points.find((point) => point.is_primary) ?? points[0];
    if (primary !== undefined && primaryValue(party, type) === value) return;
    if (primary !== undefined) {
      await transport.patch(`${partyPath(party.id)}/contact-points/${encodeURIComponent(primary.id)}`, apiContactPointResponseSchema, { value });
      return;
    }
    await transport.post(`${partyPath(party.id)}/contact-points`, apiContactPointResponseSchema, { type, value, is_primary: true });
  };

  const syncIdentifier = async (party: ApiParty, values: TenantInput, plan: ReturnType<typeof planIdentifier>): Promise<void> => {
    if (plan === null || plan.action === 'none') return;
    if (plan.action === 'update' && plan.identifierId !== undefined) {
      await transport.patch(`${partyPath(party.id)}/identifiers/${encodeURIComponent(plan.identifierId)}`, apiIdentifierResponseSchema, { value: values.idNumber });
      return;
    }
    await transport.post(`${partyPath(party.id)}/identifiers`, apiIdentifierResponseSchema, { scheme: plan.scheme, country: party.address?.country ?? (await organizationCountry()), value: values.idNumber });
  };

  const assertIdentifier = (plan: ReturnType<typeof planIdentifier>, existing: boolean): void => {
    if (plan?.action === 'none' && !existing) throw invalid(ID_NUMBER_REQUIRED, 'idNumber');
  };

  const createTenant = async (raw: unknown): Promise<Tenant> => {
    const values = parseInput(tenantInputSchema, raw);
    const plan = planIdentifier(null, values);
    assertIdentifier(plan, false);
    const { data: created } = await transport.post('/parties', apiPartyResponseSchema, createPartyPayload(values));
    remember(context, created);
    try {
      await syncContact(created, 'email', values.email);
      await syncContact(created, 'phone', values.phone);
      await syncIdentifier(created, values, plan);
    } catch (error) {
      throw partial(created, values, error);
    }
    context.latest.delete(created.id);
    return requireTenant(created.id);
  };

  const updateTenant = async (id: string, raw: unknown): Promise<Tenant> => {
    const values = parseInput(tenantInputSchema, raw);
    const current = await knownParty(context, id);
    if ((current.kind === 'company') !== (values.kind === 'societe')) throw invalid(KIND_LOCKED, 'kind');
    const plan = planIdentifier(current, values);
    assertIdentifier(plan, current.identifiers.some((identifier) => identifier.scheme === plan?.scheme));
    let patched: ApiParty;
    try {
      patched = (await transport.patch(partyPath(id), apiPartyResponseSchema, updatePartyPayload(current, values))).data;
    } catch (error) {
      if (isTenantStaleVersion(error)) context.latest.delete(id);
      throw error;
    }
    try {
      await syncContact(current, 'email', values.email);
      await syncContact(current, 'phone', values.phone);
      await syncIdentifier(patched, values, plan);
    } catch (error) {
      throw partial(patched, values, error);
    }
    context.latest.delete(id);
    return requireTenant(id);
  };

  const setTenantArchived = async (id: string, archived: boolean): Promise<Tenant> => {
    const { data } = archived
      ? await transport.post(`${partyPath(id)}/archive`, apiPartyResponseSchema)
      : await transport.delete(`${partyPath(id)}/archive`, apiPartyResponseSchema);
    context.latest.delete(id);
    return fromParty(data);
  };

  const anonymizeTenant = async (id: string): Promise<Tenant> => {
    const { data } = await transport.post(`${partyPath(id)}/anonymization`, apiPartyResponseSchema);
    context.latest.delete(id);
    return fromParty(data);
  };

  return {
    ...operations,
    unavailableInApiMode: LOCATAIRES_FEATURES,
    units,
    tenants,
    tenant,
    tenantDetail,
    tenantPage,
    createTenant,
    updateTenant,
    setTenantArchived,
    anonymizeTenant,
    deleteTenant: noRoute('Supprimer un locataire'),
    inviteTenant: noRoute('Inviter un locataire'),
    invitePortal: noRoute('Inviter sur l’espace locataire'),
    candidates: noRoute('Candidats'),
    inviteCandidate: noRoute('Inviter un candidat'),
    setCandidateStatus: noRoute('Changer le statut d’un candidat'),
    convertCandidate: noRoute('Créer un bail depuis un candidat'),
    // L'occupation d'un lot se déduit des baux côté serveur : rien à écrire sur le locataire.
    assignTenantUnit: () => Promise.resolve(),
    releaseUnit: () => Promise.resolve(),
  };
}
