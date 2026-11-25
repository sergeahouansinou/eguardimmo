import { AMENITY_ICON } from "@/lib/roost-data";
import type { I18nKey } from "@/lib/i18n/dictionaries";

const HEATING = ["M12 3c1 3 4 5 4 9a4 4 0 0 1-8 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-5 0-8z"];
const ELEVATOR = ["M5 3h14v18H5z", "M9 9l3-3 3 3", "M9 15l3 3 3-3"];
const GARDEN = ["M12 21v-8", "M12 13c-4 0-6-3-6-7 4 0 6 3 6 7z", "M12 13c4 0 6-3 6-7-4 0-6 3-6 7z"];
const GENERIC = ["M5 12l5 5 10-10"];

interface AmenityDef {
  labelKey: I18nKey;
  icon: readonly string[];
}

export const AMENITY_DEFS: Readonly<Record<string, AmenityDef>> = {
  wifi: { labelKey: "ficheAmWifi", icon: AMENITY_ICON.wifi },
  kitchen: { labelKey: "ficheAmKitchen", icon: AMENITY_ICON.kitchen },
  washer: { labelKey: "ficheAmWasher", icon: AMENITY_ICON.wash },
  dishwasher: { labelKey: "ficheAmDishwasher", icon: AMENITY_ICON.water },
  air_conditioning: { labelKey: "ficheAmAirConditioning", icon: AMENITY_ICON.ac },
  heating: { labelKey: "ficheAmHeating", icon: HEATING },
  parking: { labelKey: "ficheAmParking", icon: AMENITY_ICON.car },
  elevator: { labelKey: "ficheAmElevator", icon: ELEVATOR },
  balcony: { labelKey: "ficheAmBalcony", icon: AMENITY_ICON.terrace },
  terrace: { labelKey: "ficheAmTerrace", icon: AMENITY_ICON.terrace },
  garden: { labelKey: "ficheAmGarden", icon: GARDEN },
  pool: { labelKey: "ficheAmPool", icon: AMENITY_ICON.pool },
  tv: { labelKey: "ficheAmTv", icon: AMENITY_ICON.tv },
  workspace: { labelKey: "ficheAmWorkspace", icon: AMENITY_ICON.desk },
  pets_allowed: { labelKey: "ficheAmPetsAllowed", icon: AMENITY_ICON.paw },
  step_free_access: { labelKey: "ficheAmStepFree", icon: AMENITY_ICON.accessible },
};

export const GENERIC_AMENITY_ICON: readonly string[] = GENERIC;
