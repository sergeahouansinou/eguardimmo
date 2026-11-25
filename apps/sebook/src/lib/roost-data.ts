// Roost design data - gradients, listings, destinations, categories.
// Recreated from "Roost - Stays.dc.html" design handoff.

export const FONTS = {
  body: "var(--font-hanken), system-ui, sans-serif",
  ui: "var(--font-schibsted), sans-serif",
  serif: "var(--font-playfair), serif",
  script: "var(--font-dancing), cursive",
} as const;

export type SceneKey =
  | "sunset"
  | "ocean"
  | "mountain"
  | "forest"
  | "sand"
  | "lavender"
  | "tropical"
  | "terracotta"
  | "slate";

export const GRADIENTS: Record<SceneKey, string> = {
  sunset:
    "radial-gradient(70px 70px at 74% 26%, rgba(255,243,214,.95), transparent 62%), linear-gradient(to bottom, #FBCB8F 0%, #F2935E 42%, #E0644F 76%, #B8463F 100%)",
  ocean:
    "radial-gradient(64px 64px at 80% 20%, rgba(255,250,236,.85), transparent 66%), linear-gradient(to bottom, #C3E2EC 0%, #84BACB 42%, #3E84A0 66%, #2A607A 100%)",
  mountain:
    "linear-gradient(to bottom, #DCE7EF 0%, #B7CADA 44%, #8AA3BA 70%, #62798F 100%)",
  forest:
    "radial-gradient(60px 60px at 76% 24%, rgba(255,250,228,.6), transparent 60%), linear-gradient(to bottom, #CFE0BF 0%, #9DBE8B 40%, #5E8762 70%, #3A5A44 100%)",
  sand: "radial-gradient(72px 72px at 72% 28%, rgba(255,247,225,.95), transparent 60%), linear-gradient(to bottom, #F2E3C3 0%, #E3C795 44%, #CDA86E 74%, #AF8C53 100%)",
  lavender:
    "radial-gradient(58px 58px at 78% 22%, rgba(255,246,236,.5), transparent 60%), linear-gradient(to bottom, #CDC2E2 0%, #A294C6 44%, #6E5E96 74%, #463A6B 100%)",
  tropical:
    "radial-gradient(60px 60px at 76% 24%, rgba(255,250,228,.55), transparent 60%), linear-gradient(to bottom, #C2E8D7 0%, #80C9B0 42%, #3E9E86 70%, #297C67 100%)",
  terracotta:
    "radial-gradient(64px 64px at 74% 26%, rgba(255,243,222,.8), transparent 62%), linear-gradient(to bottom, #ECCBB1 0%, #D99A78 44%, #B8694A 78%, #8C4632 100%)",
  slate:
    "linear-gradient(to bottom, #CCD4DD 0%, #9AA7B3 44%, #6B7884 72%, #4A535D 100%)",
};

// Période de tarification d'une annonce (backend `announces.paid_per`).
// Le `price` est le prix POUR UNE période ; le tarif/nuit est pro-raté.
export type PricePeriod = "day" | "week" | "month" | "year";

// Nombre de nuits couvertes par une période (doit matcher EXACTEMENT le backend).
// Sert aussi de séjour minimum (nights >= periodDays).
const PERIOD_DAYS: Record<PricePeriod, number> = {
  day: 1,
  week: 7,
  month: 30,
  year: 365,
};

/** Nombre de nuits dans une période de tarification (day=1, week=7, month=30, year=365). */
export function periodDays(period: PricePeriod): number {
  return PERIOD_DAYS[period];
}

// Libellé FR de l'unité de période, pour l'affichage du prix ("/ {unité}").
const PERIOD_UNIT_LABEL_FR: Record<PricePeriod, string> = {
  day: "nuit",
  week: "semaine",
  month: "mois",
  year: "an",
};

/** Libellé FR de l'unité de période ("nuit" | "semaine" | "mois" | "an"). */
export function periodUnitLabelFr(period: PricePeriod): string {
  return PERIOD_UNIT_LABEL_FR[period];
}

// Clé i18n de l'unité de période ("{prix} / {unité}"), localisée via t().
export const PERIOD_UNIT_KEY: Record<
  PricePeriod,
  "unitDay" | "unitWeek" | "unitMonth" | "unitYear"
> = {
  day: "unitDay",
  week: "unitWeek",
  month: "unitMonth",
  year: "unitYear",
};

export type ListingKind = "short_stay" | "long_term";
export type ListingCategoryId = "studio" | "apartment" | "house" | "shared";

export interface Listing {
  id: string;
  title: string;
  subtitle: string;
  price: string;
  priceValue: number;
  scene: SceneKey;
  pricePeriod: PricePeriod;
  currency: string;
  kind: ListingKind;
  category: ListingCategoryId;
  city: string | null;
  neighbourhood: string | null;
  maxGuests: number;
  minNights: number | null;
  hostName: string | null;
}

export type IconPath = string | { t: "circle"; a: Record<string, number> };

export interface CategoryDef {
  id: string;
  label: string;
  d: IconPath | IconPath[];
}

export type HomeCategoryId = "all" | "short" | "long" | ListingCategoryId;

export interface HomeCategoryDef {
  id: HomeCategoryId;
  d: IconPath | IconPath[];
}

export const HOME_CATEGORIES: HomeCategoryDef[] = [
  { id: "all", d: ["M4 5h6v6H4z", "M14 5h6v6h-6z", "M4 14h6v6H4z", "M14 14h6v6h-6z"] },
  { id: "short", d: [{ t: "circle", a: { cx: 12, cy: 12, r: 8 } }, "M12 8 V12 L15 14"] },
  { id: "long", d: ["M4 6 H20 V20 H4 Z", "M4 10 H20", "M8 4 V8", "M16 4 V8"] },
  { id: "studio", d: ["M4 8 H20 V19 H4 Z", "M9 8 V5 H15 V8", "M4 13 H20"] },
  { id: "apartment", d: ["M6 20 V4 H18 V20", "M3 20 H21", "M9.5 8 H10.5", "M13.5 8 H14.5", "M9.5 12 H10.5", "M13.5 12 H14.5"] },
  { id: "house", d: ["M3.5 11 L12 4 L20.5 11", "M5.5 9.5 V20 H18.5 V9.5", "M10 20 V14 H14 V20"] },
  {
    id: "shared",
    d: [
      { t: "circle", a: { cx: 8.5, cy: 8, r: 2.6 } },
      { t: "circle", a: { cx: 15.5, cy: 8, r: 2.6 } },
      "M4 19 c0 -3 2 -5 4.5 -5 s4.5 2 4.5 5",
      "M11 19 c0 -3 2 -5 4.5 -5 s4.5 2 4.5 5",
    ],
  },
];

export function matchesHomeCategory(l: Pick<Listing, "kind" | "category">, category: HomeCategoryId): boolean {
  switch (category) {
    case "all":
      return true;
    case "short":
      return l.kind === "short_stay";
    case "long":
      return l.kind === "long_term";
    default:
      return l.category === category;
  }
}

// ============================================================

// Brand accent (mirrors the eGuardImmo green used across the app).
export const ACCENT = "#85C920";
export const ACCENT_HOVER = "#79B81C";

export const ALL_SCENES: SceneKey[] = [
  "sunset",
  "ocean",
  "mountain",
  "forest",
  "sand",
  "lavender",
  "tropical",
  "terracotta",
  "slate",
];

// Formatage monétaire conscient de la devise (annonces réelles de l'API).
// La devise est celle du pays de l'annonce (pas de conversion) ; EUR par défaut.
export function formatMoney(
  amount: number,
  currencyCode = "EUR",
  locale = "fr-FR",
): string {
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: currencyCode,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    // Code devise invalide → repli lisible.
    return `${Math.round(amount).toLocaleString(locale)} ${currencyCode}`;
  }
}
export interface AmenityItem {
  label: string;
  d: string[];
  strike?: boolean;
}
export interface AmenityGroup {
  title: string;
  items: AmenityItem[];
}
export interface HighlightItem {
  // Clé i18n du titre (résolue côté composant) + params éventuels (ex. nom d'hôte réel).
  titleKey: string;
  titleParams?: Record<string, string | number>;
  // Clé i18n de la description (phrase neutre localisée, jamais un texte figé).
  descKey: string;
  d: string[];
}
// Avis RÉEL exposé par l'API (relation `reviews` de l'annonce). Une seule note
// globale `rating` (1-5) + un commentaire. JAMAIS d'email/téléphone/user_id.
export interface ReviewItem {
  // Prénom + initiale du nom (ex. "Marie D.") ; "Voyageur" si l'avis n'a pas d'auteur.
  author: string;
  // Note globale entière 1-5 (pas de notes par catégorie côté modèle).
  rating: number;
  // Commentaire libre.
  comment: string;
  // Date ISO de création de l'avis.
  created_at: string;
}
// Politique d'annulation applicative (enum backend `cancellation_policy`).
export type CancellationPolicy = "flexible" | "moderate" | "strict";

// Un fait réel de la fiche (clé i18n singulier/pluriel + valeur). Aucune valeur
// fabriquée : un fait n'est ajouté que si le champ API correspondant est présent (>0).
export interface FactItem {
  // Clé i18n résolue côté composant via t(key, { n }).
  key: string;
  // Valeur numérique réelle (m², pièces, chambres, sdb, WC).
  n: number;
}

const ICON = {
  wifi: ["M5 12.5a10 10 0 0 1 14 0", "M8.5 16a5 5 0 0 1 7 0", "M12 19.5h.01"],
  kitchen: [
    "M6 3v6a3 3 0 0 0 6 0V3",
    "M9 3v18",
    "M16 3c-1.5 1-2 3-2 5s.5 4 2 5v8",
  ],
  ac: [
    "M3 7h18a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1z",
    "M6 17v1M10 17v2M14 17v1M18 17v2",
  ],
  tv: ["M3 5h18v11H3z", "M8 20h8M12 16v4"],
  car: ["M5 16l1.5-6h11L19 16", "M3 16h18v3H3z", "M6 19v2M18 19v2"],
  wash: [
    "M4 3h16v18H4z",
    "M12 16a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z",
    "M7 6h.01M10 6h.01",
  ],
  water: ["M12 3s6 6 6 11a6 6 0 0 1-12 0c0-5 6-11 6-11z"],
  desk: ["M3 7h18M4 7v12M20 7v12M4 19h16", "M8 7V5h8v2"],
  pool: [
    "M3 18c1.5 0 1.5-1.5 3-1.5S7.5 18 9 18s1.5-1.5 3-1.5S13.5 18 15 18s1.5-1.5 3-1.5S18 16.5 18 16.5",
    "M8 14V6a2 2 0 1 1 4 0",
    "M8 10h4",
  ],
  fridge: ["M6 3h12v18H6z", "M6 10h12M10 6v2M10 13v3"],
  terrace: ["M3 21h18M5 21v-8M19 21v-8M3 13h18", "M12 3l8 6H4z"],
  fire: ["M12 3l8 4v5c0 4.5-3.2 7.8-8 9-4.8-1.2-8-4.5-8-9V7l8-4z"],
  key: ["M3 11h13a2 2 0 0 1 2 2v0", "M15 9l4 2-4 2", "M3 11l-2 2 2 2"],
  // Éclair (électricité).
  bolt: ["M13 2 4 14h6l-1 8 9-12h-6l1-8z"],
  // Bouclier (gardien / sécurité).
  shield: ["M12 3l8 3v6c0 4.5-3.2 7.8-8 9-4.8-1.2-8-4.5-8-9V6l8-3z"],
  // Patte d'animal (animaux acceptés) - paths uniquement (compatibles string[]).
  paw: [
    "M12 13.5c2.2 0 4 1.8 4 3.4 0 1.5-1.3 2.1-2.6 2.1-.6 0-1-.3-1.4-.3s-.8.3-1.4.3C9.3 19 8 18.4 8 16.9c0-1.6 1.8-3.4 4-3.4z",
    "M7.5 11.4a1.4 1.4 0 1 0 0-2.8 1.4 1.4 0 0 0 0 2.8z",
    "M10.5 8.9a1.4 1.4 0 1 0 0-2.8 1.4 1.4 0 0 0 0 2.8z",
    "M13.5 8.9a1.4 1.4 0 1 0 0-2.8 1.4 1.4 0 0 0 0 2.8z",
    "M16.5 11.4a1.4 1.4 0 1 0 0-2.8 1.4 1.4 0 0 0 0 2.8z",
  ],
  // Fauteuil roulant (accès handicapé).
  accessible: [
    "M11 7a2 2 0 1 0 0-4 2 2 0 0 0 0 4z",
    "M11 8v5h4l3 6",
    "M11 13a5 5 0 1 0 4.5 7",
  ],
  // Maison (logement entier).
  house: ["M3 11l9-7 9 7", "M5 10v10h14V10", "M10 20v-5h4v5"],
};

// Map des icônes d'équipement, exporté pour le service (mapping booléens → SVG).
export const AMENITY_ICON = ICON;

export interface CharacteristicItem {
  labelKey: string;
  value?: string;
  valueKey?: string;
  icon: string[];
}

