import type { ApiClient } from '@eguardimmo/api';
import { BIENS_FEATURES, biensFeatureLabel } from '../capabilities';
import type { BiensFeature } from '../capabilities';
import { BiensError, isStaleVersion } from '../errors';
import type { Currency } from '../../../format/money';
import { todayIso } from '../lib/dates';
import type { BiensSource } from '../source';
import type { ImmeubleRow } from '../schemas/immeubles';
import type { LotRow, LotType } from '../schemas/lots';
import { unsupported } from './apiErrors';
import { KEY_BY_TYPE, currencyOfCountry, toCurrency, toImmeubleDetail, toImmeubleRow, toLeaseData, toLotDetail, toLotRow, toLotType } from './apiMapping';
import { buildOccupation } from './apiOccupation';
import { createPropertyPayload, createUnitPayload, isServerId, ownershipPayload, updatePropertyPayload, updateUnitPayload } from './apiPayloads';
import type { OwnershipInput, TypeChoice } from './apiPayloads';
import {
  fetchAllProperties,
  fetchAllUnits,
  fetchOccupancy,
  fetchOwnerships,
  fetchProperty,
  fetchPropertyPage,
  fetchUnit,
  fetchUnitLeases,
  fetchUnitPage,
  forget,
  knownProperty,
  knownUnit,
  propertyPath,
  unitPath,
} from './apiReads';
import type { ApiContext, Page, PropertyPageQuery, UnitPageQuery } from './apiReads';
import { apiLeaseDetailResponseSchema, apiOwnershipResponseSchema, apiPropertyResponseSchema, apiUnitResponseSchema, apiUnitTreeResponseSchema, apiUnitTypeTermsResponseSchema } from './apiSchemas';
import type { ApiOccupancy, ApiOwnership, ApiUnit, ApiUnitNode } from './apiSchemas';
import { createTransport } from './apiTransport';

export interface ApiBiensSourceOptions {
  client: ApiClient;
  organizationId: string | null;
}

export interface ApiBiensSourceDependencies {
  now?: () => Date;
}

export interface LotNode {
  id: string;
  name: string;
  type: LotType;
  archived: boolean;
  annexes: LotNode[];
}

export interface Ownership {
  id: string;
  lotId: string;
  partyId: string;
  shareBp: number;
  nature: ApiOwnership['nature'];
  validFrom: string;
  validTo: string | null;
}

export interface ApiBiensExtras {
  lotPage: (query?: UnitPageQuery) => Promise<Page<LotRow>>;
  immeublePage: (query?: PropertyPageQuery) => Promise<Page<ImmeubleRow>>;
  lotStructure: (id: string) => Promise<LotNode>;
  ownerships: (lotId: string, at?: string) => Promise<Ownership[]>;
  addOwnership: (lotId: string, input: OwnershipInput) => Promise<Ownership>;
  endOwnership: (lotId: string, ownershipId: string, validTo: string) => Promise<Ownership>;
}

export type ApiBiensSource = BiensSource & ApiBiensExtras;

const toNode = (node: ApiUnitNode): LotNode => ({ id: node.id, name: node.reference, type: toLotType(node.unit_type.key), archived: node.archived_at !== null, annexes: node.annexes.map(toNode) });

const toOwnership = (ownership: ApiOwnership): Ownership => ({
  id: ownership.id,
  lotId: ownership.unit_id,
  partyId: ownership.party_id,
  shareBp: ownership.share_bp,
  nature: ownership.nature,
  validFrom: ownership.valid_from,
  validTo: ownership.valid_to,
});

const notFound = (what: string): BiensError => new BiensError(`${what} introuvable.`, { kind: 'not_found', status: 404, code: 'not_found' });

const unavailable = (feature: BiensFeature) => (): Promise<never> => Promise.reject(unsupported(`${biensFeatureLabel[feature]} : cette fonction n’est pas encore reliée au serveur.`));

export function createApiBiensSource({ client, organizationId }: ApiBiensSourceOptions, { now = () => new Date() }: ApiBiensSourceDependencies = {}): ApiBiensSource {
  const transport = createTransport(client, organizationId);
  const context: ApiContext = { transport, units: new Map(), properties: new Map(), today: () => todayIso(now()) };
  let typeTerms: Promise<TypeTerm[]> | null = null;

  interface TypeTerm {
    id: string;
    key: string;
    semantic: string | null;
  }

  const loadTypes = (refresh: boolean): Promise<TypeTerm[]> => {
    if (refresh || typeTerms === null) {
      typeTerms = transport.get('/catalog/vocabularies/unit_type/terms', apiUnitTypeTermsResponseSchema).then(
        ({ data }) => data.filter((term) => !term.archived && !term.hidden).map((term) => ({ id: term.id, key: term.key, semantic: term.semantic_key })),
        (error: unknown) => {
          typeTerms = null;
          throw error;
        },
      );
    }
    return typeTerms;
  };

  const resolveType = async (type: LotType, current?: { unit_type: { id: string; key: string; semantic_key: string | null } }): Promise<TypeChoice> => {
    if (current && toLotType(current.unit_type.key) === type) return { id: current.unit_type.id, semantic: current.unit_type.semantic_key };
    const key = KEY_BY_TYPE[type];
    if (key === undefined) throw new BiensError('Ce type de lot ne peut pas être choisi : sélectionnez un autre type.', { kind: 'invalid', status: 422, code: 'invalid_input' });
    const find = (terms: readonly TypeTerm[]) => terms.find((term) => term.key === key);
    const found = find(await loadTypes(false)) ?? find(await loadTypes(true));
    if (found === undefined) throw new BiensError('Ce type de lot n’est pas ouvert dans votre catalogue : activez-le dans les référentiels.', { kind: 'invalid', status: 422, code: 'unit_type_unavailable' });
    return { id: found.id, semantic: found.semantic };
  };

  const currencyOfProperty = async (propertyId: string | undefined): Promise<Currency> => {
    if (propertyId !== undefined) return currencyOfCountry((await knownProperty(context, propertyId)).address.country);
    const first = (await fetchPropertyPage(context, { status: 'all', perPage: 1 })).items[0];
    return first ? currencyOfCountry(first.address.country) : 'EUR';
  };

  const orNull = async <T,>(load: () => Promise<T>): Promise<T | null> => {
    try {
      return await load();
    } catch (error) {
      if (error instanceof BiensError && error.kind === 'not_found') return null;
      throw error;
    }
  };

  const guarded = async <T,>(kind: 'unit' | 'property', id: string, run: () => Promise<T>): Promise<T> => {
    try {
      return await run();
    } catch (error) {
      if (isStaleVersion(error)) forget(context, kind, id);
      throw error;
    }
  };

  const lotRows = async (units: readonly ApiUnit[]): Promise<LotRow[]> => {
    const occupancy = await fetchOccupancy(context, units.filter((unit) => unit.archived_at === null).map((unit) => unit.id));
    return units.map((unit) => toLotRow(unit, occupancy.get(unit.id)));
  };

  const requireUnitId = (id: string): void => {
    if (!isServerId(id)) throw notFound('Bien');
  };

  const setUnitArchived = async (id: string, archived: boolean): Promise<void> => {
    const { data } = archived ? await transport.post(`${unitPath(id)}/archive`, apiUnitResponseSchema) : await transport.delete(`${unitPath(id)}/archive`, apiUnitResponseSchema);
    context.units.set(data.id, data);
  };

  const mapOwnership = async (run: () => Promise<{ data: ApiOwnership }>): Promise<Ownership> => toOwnership((await run()).data);

  const unavailableMethods = {
    lotDiagnostics: unavailable('diagnostics'),
    lotSuivi: unavailable('interventions'),
    lotFinances: unavailable('finances'),
    immeubleCharges: unavailable('charges'),
    immeubleCopro: unavailable('copropriete'),
    immeubleInterventions: unavailable('interventions'),
    equipements: unavailable('equipements'),
    equipement: unavailable('equipements'),
    equipementInterventions: unavailable('equipements'),
    readings: unavailable('releves'),
    inventaires: unavailable('inventaires'),
    documents: unavailable('documents'),
    duplicateLot: unavailable('duplication'),
    setLotListing: unavailable('annonces'),
    importLots: unavailable('import'),
    addDiagnostic: unavailable('diagnostics'),
    orderDiagnostics: unavailable('diagnostics'),
    deleteLot: unavailable('suppression'),
    deleteImmeuble: unavailable('suppression'),
    createEquipement: unavailable('equipements'),
    updateEquipement: unavailable('equipements'),
    setEquipementArchived: unavailable('equipements'),
    deleteEquipement: unavailable('equipements'),
    addLogEntry: unavailable('equipements'),
    addOperation: unavailable('equipements'),
    addDocument: unavailable('documents'),
    setDocumentShared: unavailable('documents'),
    deleteDocument: unavailable('documents'),
    createReading: unavailable('releves'),
    updateReading: unavailable('releves'),
    attachReadingPhoto: unavailable('releves'),
    setReadingArchived: unavailable('releves'),
    deleteReading: unavailable('releves'),
    createInventaire: unavailable('inventaires'),
    updateInventaire: unavailable('inventaires'),
    requestInventaireSignature: unavailable('inventaires'),
    duplicateInventaire: unavailable('inventaires'),
    setInventaireArchived: unavailable('inventaires'),
    deleteInventaire: unavailable('inventaires'),
  } satisfies Partial<BiensSource>;

  return {
    ...unavailableMethods,
    unavailableInApiMode: BIENS_FEATURES,

    lots: async () => {
      const units = await fetchAllUnits(context);
      const [items, currency] = await Promise.all([lotRows(units), currencyOfProperty(units[0]?.property.id)]);
      return { currency, items };
    },
    lot: async (id) => {
      if (!isServerId(id)) return null;
      const unit = await orNull(() => fetchUnit(context, id));
      if (unit === null) return null;
      const [property, occupancy] = await Promise.all([fetchProperty(context, unit.property.id), unit.archived_at === null ? fetchOccupancy(context, [id]) : Promise.resolve(new Map<string, ApiOccupancy>())]);
      return toLotDetail(unit, property, occupancy.get(id));
    },
    lotOccupation: async (id) => {
      requireUnitId(id);
      const unit = await knownUnit(context, id);
      const [leases, ownerships] = await Promise.all([fetchUnitLeases(context, id), fetchOwnerships(context, id)]);
      const first = leases[0];
      const currency = first ? toCurrency(first.currency) : await currencyOfProperty(unit.property.id);
      return buildOccupation({ leases, ownerships, asOf: context.today(), currency });
    },
    lotLease: async (id) => {
      requireUnitId(id);
      const occupancy = (await fetchOccupancy(context, [id])).get(id);
      if (!occupancy?.lease) return null;
      const { data } = await transport.get(`/leases/${encodeURIComponent(occupancy.lease.id)}`, apiLeaseDetailResponseSchema);
      return toLeaseData(data);
    },
    immeubles: async () => ({ items: (await fetchAllProperties(context)).map(toImmeubleRow) }),
    immeuble: async (id) => {
      if (!isServerId(id)) return null;
      const property = await orNull(() => fetchProperty(context, id));
      return property === null ? null : toImmeubleDetail(property);
    },

    createLot: async (values) => {
      const type = await resolveType(values.type);
      const { data } = await transport.post('/units', apiUnitResponseSchema, createUnitPayload(values, type));
      context.units.set(data.id, data);
      return { id: data.id };
    },
    updateLot: async (id, values) => {
      requireUnitId(id);
      await guarded('unit', id, async () => {
        const current = await knownUnit(context, id);
        const type = await resolveType(values.type, current);
        const { data } = await transport.patch(unitPath(id), apiUnitResponseSchema, updateUnitPayload(current, values, type));
        context.units.set(data.id, data);
      });
    },
    setLotsArchived: async (ids, archived) => {
      const results = await Promise.allSettled(ids.map((id) => setUnitArchived(id, archived)));
      const failed = results.filter((result): result is PromiseRejectedResult => result.status === 'rejected');
      if (failed.length === 0) return;
      const reason: unknown = failed[0]?.reason;
      if (ids.length === 1) throw reason;
      const message = reason instanceof Error ? reason.message : 'erreur inconnue';
      throw new BiensError(`${String(failed.length)} bien(s) sur ${String(ids.length)} n’ont pas pu être ${archived ? 'archivés' : 'restaurés'} : ${message}`, { kind: reason instanceof BiensError ? reason.kind : 'conflict', cause: reason });
    },

    createImmeuble: async (values) => {
      const { data } = await transport.post('/properties', apiPropertyResponseSchema, createPropertyPayload(values));
      context.properties.set(data.id, data);
      return { id: data.id };
    },
    updateImmeuble: async (id, values) => {
      if (!isServerId(id)) throw notFound('Immeuble');
      await guarded('property', id, async () => {
        const current = await knownProperty(context, id);
        const { data } = await transport.patch(propertyPath(id), apiPropertyResponseSchema, updatePropertyPayload(current, values));
        context.properties.set(data.id, data);
      });
    },
    setImmeubleArchived: async (id, archived) => {
      if (!isServerId(id)) throw notFound('Immeuble');
      const { data } = archived ? await transport.post(`${propertyPath(id)}/archive`, apiPropertyResponseSchema) : await transport.delete(`${propertyPath(id)}/archive`, apiPropertyResponseSchema);
      context.properties.set(data.id, data);
    },

    lotPage: async (query = {}) => {
      const { items, nextCursor } = await fetchUnitPage(context, query);
      return { items: await lotRows(items), nextCursor };
    },
    immeublePage: async (query = {}) => {
      const { items, nextCursor } = await fetchPropertyPage(context, query);
      return { items: items.map(toImmeubleRow), nextCursor };
    },
    lotStructure: async (id) => {
      requireUnitId(id);
      return toNode((await transport.get(`${unitPath(id)}/annexes`, apiUnitTreeResponseSchema)).data);
    },
    ownerships: async (lotId, at) => {
      requireUnitId(lotId);
      return (await fetchOwnerships(context, lotId, at)).map(toOwnership);
    },
    addOwnership: (lotId, input) => {
      requireUnitId(lotId);
      return mapOwnership(() => transport.post(`${unitPath(lotId)}/ownerships`, apiOwnershipResponseSchema, ownershipPayload(input)));
    },
    endOwnership: (lotId, ownershipId, validTo) => {
      requireUnitId(lotId);
      return mapOwnership(() => transport.post(`${unitPath(lotId)}/ownerships/${encodeURIComponent(ownershipId)}/end`, apiOwnershipResponseSchema, { valid_to: validTo }));
    },
  };
}
