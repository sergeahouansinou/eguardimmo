export const AGENCY_A = { id: "0193a5e1-0000-7000-8000-0000000000b1", name: "Agence du Lac" };
export const AGENCY_B = { id: "0193a5e1-0000-7000-8000-0000000000b2", name: "Cabinet Horizon" };
export const MANDANT_A = { name: "Famille Dossou" };
export const MANDANT_B = { name: "SCI Les Palmiers" };

export const eur = (amount: number) => ({ amount, currency: "EUR" });
export const xof = (amount: number) => ({ amount, currency: "XOF" });

export const ADDRESS = { line1: "12 rue des Filaos", line2: null, postal_code: "75011", city: "Paris", country: "FR" };

export function page(data: readonly unknown[], nextCursor: string | null = null, extra: Record<string, unknown> = {}) {
  return {
    data,
    links: { first: null, last: null, prev: null, next: nextCursor === null ? null : "http://api.test/next" },
    meta: { path: "http://api.test/api/v1/owner/x", per_page: 25, next_cursor: nextCursor, prev_cursor: null },
    ...extra,
  };
}

export function one(data: unknown) {
  return { data };
}
