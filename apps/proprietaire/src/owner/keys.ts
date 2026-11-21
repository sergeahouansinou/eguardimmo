export const AGENCIES_STALE_MS = 30_000;

export const ownerKeys = {
  all: ["owner"] as const,
  agencies: ["owner", "agencies"] as const,
  links: ["owner", "links"] as const,
  interventions: ["owner", "interventions"] as const,
  payoutAccount: ["owner", "payout-account"] as const,
  mandates: ["owner", "mandates"] as const,
};

export const ownerLists = ["properties", "leases", "payouts", "reports", "documents", "invoices", "interventions", "mandates", "chargeStatements", "taxStatements"] as const;
export type OwnerList = (typeof ownerLists)[number];

export const listKey = (list: OwnerList, agency: string | null) => ["owner", list, { agency }] as const;
export const detailKey = (name: string, id: string) => ["owner", name, id] as const;
export const rentKey = (month: string, agency: string | null) => ["owner", "rent", month, { agency }] as const;
export const homeKey = (agency: string) => ["owner", "home", { agency }] as const;
export const statementKey = (agency: string, from: string, to: string) => ["owner", "statement", { agency, from, to }] as const;
