import { apiLeaseResponseSchema, apiOccupancyResponseSchema, apiTermsResponseSchema } from './apiSchemas';
import type { ApiLease } from './apiSchemas';
import { toLease, toOccupancy } from './apiMapping';
import type { UnitOccupancy } from './apiMapping';
import {
  addPartyPayload,
  addUnitPayload,
  cancelPayload,
  endPartyPayload,
  endUnitPayload,
  renewPayload,
  revisePayload,
  signPayload,
  terminatePayload,
} from './apiPayloads';
import type { AddPartyInput, AddUnitInput, RenewInput, TermChangeInput, TerminateInput } from './apiPayloads';
import { fetchLease, knownLease, leasePath, remember } from './apiReads';
import type { ApiContext } from './apiReads';
import { fetchRegimes } from './apiResolvers';
import type { Lease } from '../schemas';

export async function act(context: ApiContext, id: string, action: string, build: (current: ApiLease) => Record<string, unknown>): Promise<ApiLease> {
  const current = await knownLease(context, id);
  const { data } = await context.transport.post(`${leasePath(id)}${action}`, apiLeaseResponseSchema, build(current));
  return remember(context, data);
}

export function leaseOperations(context: ApiContext) {
  const lease = async (id: string): Promise<Lease> => toLease(await fetchLease(context, id), context.today());
  const run = async (id: string, action: string, build: (current: ApiLease) => Record<string, unknown>): Promise<Lease> => toLease(await act(context, id, action, build), context.today());

  return {
    lease,
    signLease: (id: string, signedOn: string = context.today()) => run(id, '/sign', (current) => signPayload(current, signedOn)),
    cancelLease: (id: string) => run(id, '/cancel', cancelPayload),
    terminateLease: (id: string, input: TerminateInput) => run(id, '/terminate', (current) => terminatePayload(current, input)),
    renewLease: (id: string, input: RenewInput = {}) => run(id, '/renew', (current) => renewPayload(current, input)),
    addParty: (id: string, input: AddPartyInput) => run(id, '/parties', (current) => addPartyPayload(current, input)),
    endParty: (id: string, leasePartyId: string, lastDay: string) => run(id, `/parties/${encodeURIComponent(leasePartyId)}/end`, (current) => endPartyPayload(current, lastDay)),
    addUnit: (id: string, input: AddUnitInput) => run(id, '/units', (current) => addUnitPayload(current, input)),
    endUnit: (id: string, leaseUnitId: string, lastDay: string, replaceWithUnitId?: string) =>
      run(id, `/units/${encodeURIComponent(leaseUnitId)}/end`, (current) => endUnitPayload(current, lastDay, replaceWithUnitId)),
    reviseTerms: async (id: string, input: { effectiveOn: string; changes: readonly TermChangeInput[] }): Promise<Lease> => {
      const current = await knownLease(context, id);
      await context.transport.post(`${leasePath(id)}/terms/revise`, apiTermsResponseSchema, revisePayload(current, input));
      return lease(id);
    },
    regimes: (unitId: string) => fetchRegimes(context.transport, unitId),
    occupancy: async (unitIds: readonly string[], date?: string): Promise<UnitOccupancy[]> => {
      const { data } = await context.transport.get('/leases/occupancy', apiOccupancyResponseSchema, {
        ...Object.fromEntries(unitIds.map((unitId, index) => [`units[${String(index)}]`, unitId])),
        date,
      });
      return data.map(toOccupancy);
    },
  };
}
