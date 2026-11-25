export const REF = "k3m7q9x2v8nb";
export const REF_2 = "t4w6y8z2c5hd";
export const BOOKING_ID = "0193a5e3-0000-7000-8000-0000000000b1";

export const ME = { data: { id: "0193a5e3-0000-7000-8000-000000000001", name: "Camille Durand", email: "camille@example.test", email_verified_at: "2026-01-02T08:00:00+00:00" } };
export const ME_UNVERIFIED = { data: { ...ME.data, email_verified_at: null } };

export function problem(status: number, code: string, detail: string, extra: Record<string, unknown> = {}) {
  return { type: `https://api.eguardimmo.test/problems/${code}`, title: detail, status, code, detail, ...extra };
}

export const SUMMARY = {
  ref: REF,
  kind: "short_stay",
  category: "studio",
  title: "Studio lumineux, Presqu’île",
  city: { slug: "lyon", name: "Lyon", postal_code: "69002" },
  neighbourhood: "Presqu’île",
  price: { amount: 7400, currency: "EUR" },
  price_unit: "night",
  capacity: 2,
  rooms: 1,
  area_m2: 28,
  amenities: ["wifi", "kitchen"],
  min_nights: 2,
  host: { name: "Agence Rhône Immo" },
};

export const SUMMARY_LONG = {
  ...SUMMARY,
  ref: REF_2,
  kind: "long_term",
  category: "apartment",
  title: "T2 rénové, Croix-Rousse",
  price: { amount: 85000, currency: "EUR" },
  price_unit: "month",
  capacity: 3,
  rooms: 2,
  area_m2: 46.5,
  min_nights: null,
  host: { name: null },
};

export const DETAIL = {
  ...SUMMARY,
  description: "Studio de 28 m² au 3e étage avec ascenseur.\nLinge fourni.",
  deposit: { amount: 30000, currency: "EUR" },
  cancellation_policy: "moderate",
  published_at: "2026-11-01T10:00:00+00:00",
};

export const DETAIL_LONG = { ...SUMMARY_LONG, description: "Deux pièces lumineuses.", deposit: null, cancellation_policy: "flexible", published_at: "2026-11-02T10:00:00+00:00" };

export const LISTINGS_PAGE = { data: [SUMMARY, SUMMARY_LONG], meta: { has_more: true, next_cursor: "eyJpZCI6MTJ9" } };
export const LISTINGS_LAST_PAGE = { data: [SUMMARY], meta: { has_more: false, next_cursor: null } };
export const LISTINGS_EMPTY = { data: [], meta: { has_more: false, next_cursor: null } };

export const PLACES = {
  data: [
    { slug: "lyon", name: "Lyon", postal_code: "69000", country: "FR" },
    { slug: "lille", name: "Lille", postal_code: "59000", country: "FR" },
  ],
};

export const AVAILABILITY = { data: [{ check_in: "2027-03-10", check_out: "2027-03-14" }] };

const eur = (amount: number) => ({ amount, currency: "EUR" });

export const QUOTE = {
  data: { nights: 2, nightly: eur(7400), subtotal: eur(14800), service_fee: eur(500), total: eur(15300), cancellation_policy: "moderate", available: true },
};

export const BOOKING_PENDING = {
  id: BOOKING_ID,
  reference: "SB-2027-000187",
  status: "pending_payment",
  payment: "to_finalize",
  listing: { ref: REF, title: SUMMARY.title, city: "Lyon", neighbourhood: "Presqu’île", host: SUMMARY.host },
  check_in: "2027-03-20",
  check_out: "2027-03-22",
  nights: 2,
  guests: 2,
  nightly: eur(7400),
  subtotal: eur(14800),
  service_fee: eur(500),
  total: eur(15300),
  cancellation_policy: "moderate",
  expires_at: "2027-01-01T10:30:00+00:00",
  cancelled_at: null,
  cancel_reason: null,
  refund: null,
};

export const BOOKING_CONFIRMED = { ...BOOKING_PENDING, id: "0193a5e3-0000-7000-8000-0000000000b2", reference: "SB-2027-000188", status: "confirmed", payment: null, expires_at: null };
export const BOOKING_COMPLETED = { ...BOOKING_PENDING, id: "0193a5e3-0000-7000-8000-0000000000b3", reference: "SB-2026-000040", check_in: "2026-08-04", check_out: "2026-08-08", status: "completed", payment: null, expires_at: null };
export const BOOKING_CANCELLED = { ...BOOKING_PENDING, id: "0193a5e3-0000-7000-8000-0000000000b4", reference: "SB-2026-000041", status: "cancelled", payment: null, cancelled_at: "2026-11-20T09:00:00+00:00", cancel_reason: "traveler_cancelled", refund: eur(15300), expires_at: null };

export const BOOKINGS_PAGE = { data: [BOOKING_PENDING, BOOKING_CONFIRMED, BOOKING_COMPLETED, BOOKING_CANCELLED], meta: { has_more: false, next_cursor: null } };
export const FAVORITES_PAGE = { data: [SUMMARY], meta: { has_more: false, next_cursor: null } };
export const FAVORITES_EMPTY = { data: [], meta: { has_more: false, next_cursor: null } };
