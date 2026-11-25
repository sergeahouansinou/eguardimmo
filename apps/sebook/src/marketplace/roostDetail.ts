import type { I18nKey } from "@/lib/i18n/dictionaries";
import { formatMinor } from "@/lib/money";
import { ALL_SCENES, AMENITY_ICON, PERIOD_UNIT_KEY } from "@/lib/roost-data";
import type { SceneKey } from "@/lib/roost-data";
import { placeLine } from "./format";
import { amenityLabel } from "./labels";
import { GENERIC_AMENITY_ICON, AMENITY_DEFS } from "./roostAmenities";
import { sceneFromRef } from "./roost";
import type { CancellationPolicy, Category, Kind, ListingDetail } from "./schemas";

export interface DetailFact {
  key: I18nKey;
  value: string | number;
}

export interface DetailAmenity {
  id: string;
  labelKey: I18nKey | null;
  fallbackLabel: string;
  icon: readonly string[];
}

export interface DetailCharacteristic {
  labelKey: I18nKey;
  value: string;
  valueKey?: I18nKey;
  icon: readonly string[];
}

export interface AnnonceView {
  ref: string;
  title: string;
  kind: Kind;
  categoryKey: I18nKey;
  place: string;
  cityName: string | null;
  facts: DetailFact[];
  paragraphs: string[];
  amenities: DetailAmenity[];
  characteristics: DetailCharacteristic[];
  hostName: string | null;
  hostInitial: string;
  scene: SceneKey;
  gallery: SceneKey[];
  priceLabel: string;
  priceUnitKey: I18nKey;
  priceUnit: "night" | "month";
  currency: string;
  capacity: number;
  minNights: number | null;
  policy: CancellationPolicy;
}

const CATEGORY_KEYS: Record<Category, I18nKey> = {
  studio: "ficheCatStudio",
  apartment: "ficheCatApartment",
  house: "ficheCatHouse",
  shared: "ficheCatShared",
};

const KIND_KEYS: Record<Kind, I18nKey> = { short_stay: "ficheKindShort", long_term: "ficheKindLong" };

const GALLERY_OFFSETS = [0, 2, 4, 6, 8] as const;

export function galleryScenes(ref: string): SceneKey[] {
  const base = ALL_SCENES.indexOf(sceneFromRef(ref));
  return GALLERY_OFFSETS.map((offset) => ALL_SCENES[(base + offset) % ALL_SCENES.length] ?? "sunset");
}

export function paragraphsOf(description: string): string[] {
  return description
    .split(/\r?\n+/)
    .map((part) => part.trim())
    .filter((part) => part !== "");
}

function factsOf(detail: ListingDetail, locale: string): DetailFact[] {
  const facts: DetailFact[] = [detail.capacity === 1 ? { key: "factGuestOne", value: 1 } : { key: "factGuests", value: detail.capacity }];
  if (detail.rooms !== null && detail.rooms > 0) {
    facts.push(detail.rooms === 1 ? { key: "factRoomOne", value: 1 } : { key: "factRooms", value: detail.rooms });
  }
  if (detail.area_m2 !== null) facts.push({ key: "factArea", value: new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(detail.area_m2) });
  return facts;
}

function amenitiesOf(ids: readonly string[]): DetailAmenity[] {
  return [...new Set(ids)].map((id) => {
    const def = AMENITY_DEFS[id];
    return { id, labelKey: def?.labelKey ?? null, fallbackLabel: amenityLabel(id), icon: def?.icon ?? GENERIC_AMENITY_ICON };
  });
}

function characteristicsOf(detail: ListingDetail): DetailCharacteristic[] {
  const items: DetailCharacteristic[] = [{ labelKey: "charRef", value: detail.public_ref, icon: AMENITY_ICON.house }];
  if (detail.kind === "short_stay" && detail.min_nights !== null && detail.min_nights > 1) {
    items.push({ labelKey: "ficheCharMinStay", value: String(detail.min_nights), valueKey: "ficheNights", icon: AMENITY_ICON.key });
  }
  if (detail.deposit_minor !== null) {
    items.push({ labelKey: "charSecurityDeposit", value: formatMinor(detail.deposit_minor, detail.currency), icon: AMENITY_ICON.shield });
  }
  return items;
}

export function kindKey(kind: Kind): I18nKey {
  return KIND_KEYS[kind];
}

export function toAnnonceView(detail: ListingDetail, locale: string): AnnonceView {
  const trimmedHost = detail.host?.name.trim() ?? "";
  const hostName = trimmedHost === "" ? null : trimmedHost;
  return {
    ref: detail.public_ref,
    title: detail.title,
    kind: detail.kind,
    categoryKey: CATEGORY_KEYS[detail.category],
    place: placeLine(detail),
    cityName: detail.city?.name ?? null,
    facts: factsOf(detail, locale),
    paragraphs: paragraphsOf(detail.description),
    amenities: amenitiesOf(detail.amenities),
    characteristics: characteristicsOf(detail),
    hostName,
    hostInitial: hostName ? (Array.from(hostName)[0] ?? "").toUpperCase() : "",
    scene: sceneFromRef(detail.public_ref),
    gallery: galleryScenes(detail.public_ref),
    priceLabel: formatMinor(detail.price_minor, detail.currency),
    priceUnitKey: PERIOD_UNIT_KEY[detail.price_unit === "night" ? "day" : "month"],
    priceUnit: detail.price_unit,
    currency: detail.currency,
    capacity: detail.capacity,
    minNights: detail.min_nights,
    policy: detail.cancellation_policy,
  };
}
