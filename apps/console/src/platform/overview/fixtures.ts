export const overviewResponse = {
  data: {
    generated_at: '2026-11-21T10:00:00+00:00',
    organizations: { total: 42, agencies: 30, individuals: 12, suspended: 1, created_30d: 5 },
    user_accounts: { total: 310, suspended: 2, suspension_to_review: 1, created_30d: 17 },
    subscriptions: { by_status: { trialing: 8, free: 20, active: 14 }, by_plan: { free: 20, gold: 14, silver: 8 }, trials_ending_7d: 3 },
    support: { open_total: 7, awaiting_support: 4, awaiting_requester: 3, unassigned: 2 },
    privacy: { open_total: 2, overdue: 1, due_within_7d: 1 },
  },
};

export const billingOverview = {
  data: {
    generated_at: '2026-11-21T10:00:00+00:00',
    organizations: overviewResponse.data.organizations,
    subscriptions: overviewResponse.data.subscriptions,
  },
};
