import { describe, expect, it } from 'vitest';
import { UnexpectedResponseError, describeProblem } from '../errors';
import { ERROR_CASES, jsonResponse, setupApi } from '../testApi';
import { billingOverview, overviewResponse } from './fixtures';
import { fetchOverview } from './overview';

describe('accueil de la console', () => {
  it('lit les cinq sections d’un administrateur', async () => {
    const { client, url } = setupApi(jsonResponse(200, overviewResponse));
    const overview = await fetchOverview(client);

    expect(url().pathname).toBe('/api/v1/console/overview');
    expect(overview).toEqual({
      generatedAt: '2026-11-21T10:00:00+00:00',
      organizations: { total: 42, agencies: 30, individuals: 12, suspended: 1, created30d: 5 },
      accounts: { total: 310, suspended: 2, suspensionToReview: 1, created30d: 17 },
      subscriptions: {
        byStatus: [
          { key: 'trialing', total: 8 },
          { key: 'free', total: 20 },
          { key: 'active', total: 14 },
        ],
        byPlan: [
          { key: 'free', total: 20 },
          { key: 'gold', total: 14 },
          { key: 'silver', total: 8 },
        ],
        trialsEnding7d: 3,
      },
      support: { openTotal: 7, awaitingSupport: 4, awaitingRequester: 3, unassigned: 2 },
      privacy: { openTotal: 2, overdue: 1, dueWithin7d: 1 },
    });
  });

  it('laisse à null les sections que le rôle ne lit pas', async () => {
    const overview = await fetchOverview(setupApi(jsonResponse(200, billingOverview)).client);

    expect(overview.organizations).not.toBeNull();
    expect(overview.subscriptions).not.toBeNull();
    expect(overview.accounts).toBeNull();
    expect(overview.support).toBeNull();
    expect(overview.privacy).toBeNull();
  });

  it('lit les répartitions vides que PHP sérialise en liste', async () => {
    const empty = { data: { ...overviewResponse.data, subscriptions: { by_status: [], by_plan: [], trials_ending_7d: 0 } } };
    const overview = await fetchOverview(setupApi(jsonResponse(200, empty)).client);

    expect(overview.subscriptions).toEqual({ byStatus: [], byPlan: [], trialsEnding7d: 0 });
  });

  it('refuse un compteur négatif, une date invalide et une répartition non numérique', async () => {
    const negative = { data: { ...overviewResponse.data, support: { ...overviewResponse.data.support, unassigned: -1 } } };
    await expect(fetchOverview(setupApi(jsonResponse(200, negative)).client)).rejects.toBeInstanceOf(UnexpectedResponseError);
    await expect(fetchOverview(setupApi(jsonResponse(200, { data: { ...overviewResponse.data, generated_at: 'hier' } })).client)).rejects.toBeInstanceOf(UnexpectedResponseError);
    const text = { data: { ...overviewResponse.data, subscriptions: { by_status: { free: 'vingt' }, by_plan: {}, trials_ending_7d: 0 } } };
    await expect(fetchOverview(setupApi(jsonResponse(200, text)).client)).rejects.toBeInstanceOf(UnexpectedResponseError);
  });

  it.each(ERROR_CASES)('classe l’erreur %i comme %s', async (status, payload, kind, code) => {
    const { client } = setupApi(jsonResponse(status, payload));
    const error: unknown = await fetchOverview(client).catch((caught: unknown) => caught);

    expect(describeProblem(error)).toMatchObject({ kind, code });
  });
});
