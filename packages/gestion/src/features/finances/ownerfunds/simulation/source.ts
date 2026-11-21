import type { z } from 'zod';
import { OwnerFundsApiError } from '../api/ownerFundsErrors';
import type { OwnerFundsTransport } from '../api/ownerFundsTransport';
import { toFeeMandate, toSimulation } from './mapping';
import type { FeeMandateOption, FeeProposal, FeeSimulation } from './model';
import { simulationPayload } from './payloads';
import { apiFeeMandatePage, apiSimulationResponse } from './schemas';

const PAGE_SIZE = 100;
const MAX_PAGES = 20;

export interface SimulationSource {
  feeMandates: () => Promise<FeeMandateOption[]>;
  simulateFees: (proposal: FeeProposal) => Promise<FeeSimulation>;
}

export function createSimulationSource(transport: OwnerFundsTransport): SimulationSource {
  return {
    feeMandates: async () => {
      const options: FeeMandateOption[] = [];
      let cursor: string | null = null;
      for (let page = 0; page < MAX_PAGES; page += 1) {
        const response: z.infer<typeof apiFeeMandatePage> = await transport.get('/mandates', apiFeeMandatePage, { status: 'active', per_page: PAGE_SIZE, cursor });
        options.push(...response.data.map(toFeeMandate));
        if (response.meta.next_cursor === null) return options;
        cursor = response.meta.next_cursor;
      }
      throw new OwnerFundsApiError('unavailable', 'Trop de mandats actifs pour les lister tous : la simulation ne peut pas être chargée.');
    },
    simulateFees: async (proposal) => toSimulation(await transport.post('/owner-funds/fees/simulations', apiSimulationResponse, null, simulationPayload(proposal))),
  };
}
