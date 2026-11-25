import { createApiClient } from "@eguardimmo/api";
import { afterEach, describe, expect, it } from "vitest";
import { stubApi } from "../../test/api";
import { describeFailure } from "./errors";
import {
  addFavorite,
  cancelBooking,
  createBooking,
  fetchBookingsPage,
  fetchFavoriteRefs,
  fetchMe,
  fetchPlaces,
  fetchAvailability,
  logout,
  removeFavorite,
  requestQuote,
  sendVisitRequest,
} from "./requests";
import { AVAILABILITY, BOOKINGS_PAGE, BOOKING_CANCELLED, BOOKING_ID, BOOKING_PENDING, ME, ME_UNVERIFIED, PLACES, QUOTE, REF, SUMMARY, problem } from "./responses.fixtures";
import { vi } from "vitest";

const M = "/api/v1/marketplace";
const client = () => createApiClient({ baseUrl: "http://api.test", readCookie: () => "xsrf" });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("client marketplace", () => {
  it("places : q en paramètre, résultats validés", async () => {
    const api = stubApi({ [`GET ${M}/places`]: { body: PLACES } });
    const places = await fetchPlaces(client(), "Ly");
    expect(places.map((place) => place.slug)).toEqual(["lyon", "lille"]);
    expect(api.last("GET", `${M}/places`)?.query.get("q")).toBe("Ly");
  });

  it("disponibilité et devis : requêtes et corps de l’ADR", async () => {
    const api = stubApi({ [`GET ${M}/listings/${REF}/availability`]: { body: AVAILABILITY }, [`POST ${M}/listings/${REF}/quote`]: { body: QUOTE } });
    expect(await fetchAvailability(client(), REF, "2027-03-01", "2028-03-01")).toEqual([{ from: "2027-03-10", to: "2027-03-14" }]);
    expect(api.last("GET", `${M}/listings/${REF}/availability`)?.query.get("to")).toBe("2028-03-01");
    const quote = await requestQuote(client(), REF, { checkIn: "2027-03-20", checkOut: "2027-03-22", guests: 2 });
    expect(quote).toEqual({ nights: 2, nightly_minor: 7400, subtotal_minor: 14800, service_fee_minor: 500, total_minor: 15300, currency: "EUR", cancellation_policy: "moderate", available: true });
    expect(api.last("POST", `${M}/listings/${REF}/quote`)?.json).toEqual({ check_in: "2027-03-20", check_out: "2027-03-22", guests: 2 });
  });

  it("réservation : clé d’idempotence en en-tête, corps sans montant", async () => {
    const api = stubApi({ [`POST ${M}/bookings`]: { status: 201, body: { data: BOOKING_PENDING } } });
    const booking = await createBooking(client(), { listingRef: REF, checkIn: "2027-03-20", checkOut: "2027-03-22", guests: 2, idempotencyKey: "cle-0001" });
    expect(booking.status).toBe("pending_payment");
    const call = api.last("POST", `${M}/bookings`);
    expect(call?.headers["idempotency-key"]).toBe("cle-0001");
    expect(call?.json).toEqual({ listing_ref: REF, check_in: "2027-03-20", check_out: "2027-03-22", guests: 2 });
  });

  it("liste des réservations paginée par curseur ; annulation renvoie le remboursement", async () => {
    const api = stubApi({
      [`GET ${M}/bookings`]: { body: BOOKINGS_PAGE },
      [`POST ${M}/bookings/${BOOKING_ID}/cancel`]: { body: { data: BOOKING_CANCELLED } },
    });
    const page = await fetchBookingsPage(client(), "CUR");
    expect(page.items).toHaveLength(4);
    expect(api.last("GET", `${M}/bookings`)?.query.get("cursor")).toBe("CUR");
    const cancelled = await cancelBooking(client(), BOOKING_ID);
    expect(cancelled).toMatchObject({ status: "cancelled", refund_minor: 15300 });
  });

  it("favoris : PUT, DELETE et lecture de toutes les pages", async () => {
    let page = 0;
    const api = stubApi({
      [`GET ${M}/favorites`]: () => ({ body: { data: [SUMMARY], meta: { next_cursor: ++page < 2 ? "C2" : null } } }),
      [`PUT ${M}/favorites/${REF}`]: { status: 204 },
      [`DELETE ${M}/favorites/${REF}`]: { status: 204 },
    });
    await addFavorite(client(), REF);
    await removeFavorite(client(), REF);
    expect(api.count("PUT", `${M}/favorites/${REF}`)).toBe(1);
    expect(api.count("DELETE", `${M}/favorites/${REF}`)).toBe(1);
    expect(await fetchFavoriteRefs(client())).toHaveLength(2);
    expect(api.calls.filter((c) => c.path === `${M}/favorites` && c.method === "GET")[1]?.query.get("cursor")).toBe("C2");
  });

  it("demande de visite : corps et 201", async () => {
    const api = stubApi({ [`POST ${M}/listings/${REF}/visit-requests`]: { status: 201, body: { data: { status: "new" } } } });
    await sendVisitRequest(client(), REF, { desiredSlot: "samedi matin", message: "Bonjour" });
    expect(api.last("POST", `${M}/listings/${REF}/visit-requests`)?.json).toEqual({ requested_slot: "samedi matin", message: "Bonjour" });
  });

  it("déconnexion : route Fortify /auth/logout, hors préfixe /api/v1", async () => {
    const api = stubApi({ "POST /auth/logout": { status: 204 } });
    await logout(client());
    expect(api.count("POST", "/auth/logout")).toBe(1);
    expect(api.calls.some((c) => c.path.startsWith("/api/v1/auth"))).toBe(false);
  });

  it("session : nom et vérification de l’e-mail", async () => {
    stubApi({ "GET /api/v1/me": { body: ME } });
    expect(await fetchMe(client())).toEqual({ name: "Camille Durand", verified: true });
    stubApi({ "GET /api/v1/me": { body: ME_UNVERIFIED } });
    expect((await fetchMe(client())).verified).toBe(false);
  });

  it("une réponse hors contrat devient une erreur « inattendue »", async () => {
    stubApi({ [`POST ${M}/listings/${REF}/quote`]: { body: { data: { total: 1 } } } });
    const error = await requestQuote(client(), REF, { checkIn: "2027-03-20", checkOut: "2027-03-22", guests: 2 }).catch((caught: unknown) => caught);
    expect(describeFailure(error).kind).toBe("unexpected");
  });
});

describe("describeFailure", () => {
  const failing = async (status: number, code: string, extra: Record<string, unknown> = {}) => {
    stubApi({ [`POST ${M}/bookings`]: { status, body: problem(status, code, "Détail serveur.", extra) } });
    const failure = await createBooking(client(), { listingRef: REF, checkIn: "2027-03-20", checkOut: "2027-03-22", guests: 2, idempotencyKey: "k" }).then(
      () => null,
      (caught: unknown) => describeFailure(caught),
    );
    if (failure === null) throw new Error("Un échec était attendu.");
    return failure;
  };

  it("409 dates_unavailable", async () => {
    expect(await failing(409, "dates_unavailable")).toMatchObject({ kind: "datesUnavailable" });
  });
  it("401 et 403 email_unverified", async () => {
    expect(await failing(401, "unauthenticated")).toMatchObject({ kind: "unauthenticated" });
    expect(await failing(403, "email_unverified")).toMatchObject({ kind: "unverified" });
  });
  it("422 expose les erreurs par champ", async () => {
    const failure = await failing(422, "validation_failed", { errors: { guests: ["Trop de voyageurs."] } });
    expect(failure).toMatchObject({ kind: "invalid", message: "Trop de voyageurs.", fieldErrors: { guests: ["Trop de voyageurs."] } });
  });
  it("500 ne divulgue pas le détail", async () => {
    const failure = await failing(500, "server_error");
    expect(failure.message).not.toContain("Détail serveur");
  });
  it("réseau injoignable", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new TypeError("réseau"))));
    const error = await fetchMe(client()).catch((caught: unknown) => caught);
    expect(describeFailure(error).kind).toBe("unreachable");
  });
});
