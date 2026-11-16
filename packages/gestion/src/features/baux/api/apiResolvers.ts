import { BauxApiError, unsupported } from './apiErrors';
import { REGIME_BY_FURNISHED, toRegime } from './apiMapping';
import type { LeaseRegime } from './apiMapping';
import type { ComponentIds, RegimeChoice } from './apiPayloads';
import { apiCatalogTermsResponseSchema, apiRegimesResponseSchema } from './apiSchemas';
import type { Transport } from './apiTransport';

const COMPONENT_SEMANTICS = { rent: 'rent', charges: 'charges_provision', deposit: 'deposit' } as const;

export async function fetchRegimes(transport: Transport, unitId: string): Promise<LeaseRegime[]> {
  const { data } = await transport.get('/leases/regimes', apiRegimesResponseSchema, { unit: unitId });
  return data.map(toRegime);
}

export async function resolveRegime(transport: Transport, unitId: string, furnished: boolean): Promise<RegimeChoice> {
  const wanted = furnished ? REGIME_BY_FURNISHED.furnished : REGIME_BY_FURNISHED.unfurnished;
  const regime = (await fetchRegimes(transport, unitId)).find((entry) => entry.key === wanted);
  if (!regime) throw unsupported('Ce bien ne peut pas être loué sous ce régime : aucun régime de bail n’est ouvert pour son pays.');
  return { jurisdiction: regime.jurisdiction, regimeKey: regime.key };
}

export function createComponentResolver(transport: Transport): () => Promise<ComponentIds> {
  let pending: Promise<ComponentIds> | null = null;
  const load = async (): Promise<ComponentIds> => {
    const { data } = await transport.get('/catalog/vocabularies/lease_component/terms', apiCatalogTermsResponseSchema);
    const usable = data.filter((term) => !term.archived && !term.hidden);
    const find = (semantic: string): string => {
      const found = usable.find((term) => term.semantic_key === semantic);
      if (!found) throw new BauxApiError('unexpected_response', `Le référentiel des composantes du loyer ne contient pas « ${semantic} ».`, { code: 'component_missing' });
      return found.id;
    };
    return { rent: find(COMPONENT_SEMANTICS.rent), charges: find(COMPONENT_SEMANTICS.charges), deposit: find(COMPONENT_SEMANTICS.deposit) };
  };
  return () => {
    pending ??= load().catch((error: unknown) => {
      pending = null;
      throw error;
    });
    return pending;
  };
}
