import { OrgApiError } from "@/features/org/errors";
import { KIND_PRICE_UNIT } from "./labels";
import type { AnnoncesSource } from "./source";
import type { Listing, ListingPayload } from "./schemas";

export const DEMO_LISTINGS_PER_PAGE = 3;
const NOW = "2026-11-13T10:02:00+00:00";

function missingOf(listing: Pick<Listing, "title" | "price" | "city" | "capacity">): string[] {
  return [
    ...(listing.title === null || listing.title.trim() === "" ? ["title"] : []),
    ...(listing.price === null || listing.price.amount < 1 ? ["price_minor"] : []),
    ...(listing.city === null ? ["city_id"] : []),
    ...(listing.capacity === null || listing.capacity < 1 ? ["capacity"] : []),
  ];
}

function listing(id: string, ref: string, rest: Partial<Listing> & Pick<Listing, "kind" | "category" | "status" | "title">): Listing {
  const base: Listing = {
    id,
    publicRef: ref,
    description: null,
    city: null,
    neighbourhood: null,
    price: null,
    priceUnit: KIND_PRICE_UNIT[rest.kind],
    deposit: null,
    capacity: null,
    areaM2: null,
    rooms: null,
    amenities: [],
    minNights: 1,
    cancellationPolicy: "moderate",
    publishedAt: null,
    missing: [],
    lockVersion: 1,
    ...rest,
  };
  return { ...base, missing: missingOf(base) };
}

const paris = { slug: "paris", name: "Paris", postalCode: "75010" };
const lyon = { slug: "lyon", name: "Lyon", postalCode: "69003" };
const bordeaux = { slug: "bordeaux", name: "Bordeaux", postalCode: "33000" };

const SEEDS: readonly Listing[] = [
  listing("ann-0005", "k7m2p9xq4tnb", { kind: "long_term", category: "shared", status: "draft", title: "Chambre en colocation près de la gare", description: "Chambre meublée dans un appartement partagé à trois.", neighbourhood: "Gare" }),
  listing("ann-0004", "d3f8r5vw2hzc", { kind: "short_stay", category: "house", status: "draft", title: "Maison avec jardin à Bordeaux", city: bordeaux, price: { amount: 15000, currency: "EUR" }, neighbourhood: "Chartrons", areaM2: 110, rooms: 5 }),
  listing("ann-0003", "w6c4n8jb5ysg", { kind: "long_term", category: "apartment", status: "published", title: "T3 familial avec balcon", description: "Appartement lumineux de 68 m² au troisième étage, proche du tramway.", city: lyon, neighbourhood: "Part-Dieu", price: { amount: 98000, currency: "EUR" }, deposit: { amount: 98000, currency: "EUR" }, capacity: 4, areaM2: 68, rooms: 3, amenities: ["heating", "balcony", "elevator"], publishedAt: "2026-10-20T09:00:00+00:00", lockVersion: 4 }),
  listing("ann-0002", "h9t2x6kq7mre", { kind: "short_stay", category: "studio", status: "published", title: "Studio lumineux près du canal Saint-Martin", description: "Studio de 24 m² rénové, idéal pour deux personnes.\nArrivée autonome avec boîte à clés.", city: paris, neighbourhood: "Canal Saint-Martin", price: { amount: 8500, currency: "EUR" }, deposit: { amount: 20000, currency: "EUR" }, capacity: 2, areaM2: 24, rooms: 1, amenities: ["wifi", "kitchen", "heating"], minNights: 2, cancellationPolicy: "flexible", publishedAt: "2026-10-02T14:30:00+00:00", lockVersion: 3 }),
  listing("ann-0001", "b5g7z3nc8vqa", { kind: "short_stay", category: "studio", status: "archived", title: "Studio rue Mazagran", city: paris, neighbourhood: "Strasbourg Saint-Denis", price: { amount: 7200, currency: "EUR" }, capacity: 2, areaM2: 19, rooms: 1, amenities: ["wifi"], publishedAt: "2026-06-12T08:00:00+00:00", lockVersion: 6 }),
];

const notFound = (): OrgApiError => new OrgApiError("not_found", "Cette annonce n’existe pas ou n’appartient pas à votre organisation.", { status: 404, code: "listing_not_found" });
const stale = (): OrgApiError => new OrgApiError("stale", "L’annonce a été modifiée depuis sa lecture : rechargez-la avant de renvoyer vos changements.", { status: 409, code: "listing_stale_version" });
const archived = (): OrgApiError => new OrgApiError("conflict", "Une annonce archivée ne se modifie plus : republiez-la d’abord.", { status: 409, code: "listing_archived" });
const incomplete = (missing: readonly string[]): OrgApiError =>
  new OrgApiError("invalid", "Pour publier, renseignez le titre, le prix, la ville et la capacité d’accueil.", { status: 422, code: "listing_incomplete", extensions: { missing } });

function applyPayload(current: Listing, payload: ListingPayload): Listing {
  const money = (amount: number | null) => (amount === null ? null : { amount, currency: payload.currency });
  const next: Listing = {
    ...current,
    category: payload.category,
    title: payload.title,
    description: payload.description,
    neighbourhood: payload.neighbourhood,
    price: money(payload.priceMinor),
    deposit: money(payload.depositMinor),
    capacity: payload.capacity,
    areaM2: payload.areaM2,
    rooms: payload.rooms,
    amenities: payload.amenities,
    minNights: payload.minNights,
    cancellationPolicy: payload.cancellationPolicy,
    lockVersion: current.lockVersion + 1,
  };
  return { ...next, missing: missingOf(next) };
}

export function createDemoAnnonces(): AnnoncesSource {
  let listings = SEEDS.map((seed) => ({ ...seed }));
  let counter = 5;
  const find = (id: string): Listing | undefined => listings.find((candidate) => candidate.id === id);
  const store = (next: Listing): Promise<Listing> => {
    listings = listings.map((candidate) => (candidate.id === next.id ? next : candidate));
    return Promise.resolve({ ...next });
  };
  const versioned = (id: string, lockVersion: number): Listing => {
    const current = find(id);
    if (current === undefined) throw notFound();
    if (current.lockVersion !== lockVersion) throw stale();
    return current;
  };
  const guarded = <T,>(run: () => Promise<T>): Promise<T> => {
    try {
      return run();
    } catch (error) {
      return Promise.reject(error instanceof Error ? error : notFound());
    }
  };
  return {
    list: (status, cursor) => {
      const matching = listings.filter((candidate) => status === null || candidate.status === status);
      const start = cursor === null ? 0 : Number(cursor);
      const next = start + DEMO_LISTINGS_PER_PAGE;
      return Promise.resolve({ items: matching.slice(start, next).map((candidate) => ({ ...candidate })), nextCursor: next < matching.length ? String(next) : null });
    },
    get: (id) => {
      const found = find(id);
      return found === undefined ? Promise.reject(notFound()) : Promise.resolve({ ...found });
    },
    create: (payload) => {
      counter += 1;
      const created = applyPayload(
        listing(`ann-${String(counter).padStart(4, "0")}`, `n${String(counter).padStart(2, "0")}c4t8w3kq5z`, { kind: payload.kind ?? "short_stay", category: payload.category, status: "draft", title: payload.title }),
        payload,
      );
      const fresh: Listing = { ...created, lockVersion: 1 };
      listings = [fresh, ...listings];
      return Promise.resolve({ ...fresh });
    },
    update: (id, lockVersion, payload) =>
      guarded(() => {
        const current = versioned(id, lockVersion);
        if (current.status === "archived") throw archived();
        const next = applyPayload(current, payload);
        if (next.status === "published" && next.missing.length > 0) throw incomplete(next.missing);
        return store(next);
      }),
    publish: (id, lockVersion) =>
      guarded(() => {
        const current = versioned(id, lockVersion);
        if (current.status === "published") return Promise.resolve({ ...current });
        if (current.missing.length > 0) throw incomplete(current.missing);
        return store({ ...current, status: "published", publishedAt: NOW, lockVersion: current.lockVersion + 1 });
      }),
    archive: (id, lockVersion) =>
      guarded(() => {
        const current = versioned(id, lockVersion);
        if (current.status === "archived") return Promise.resolve({ ...current });
        return store({ ...current, status: "archived", lockVersion: current.lockVersion + 1 });
      }),
  };
}

let shared: AnnoncesSource | null = null;

export function demoAnnonces(): AnnoncesSource {
  shared ??= createDemoAnnonces();
  return shared;
}
