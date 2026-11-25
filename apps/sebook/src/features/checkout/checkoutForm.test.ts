import { describe, expect, it } from "vitest";
import { DICT } from "@/lib/i18n/dictionaries";
import type { I18nKey } from "@/lib/i18n/dictionaries";
import { BOOKING_OUTCOMES, BOOKING_STATUS_LABELS, POLICY_LABELS } from "@/marketplace/labels";
import { OUTCOME_KEYS, POLICY_KEYS, STATUS_KEYS } from "./bookingLabels";
import { staySignature, stayFromParams } from "./checkoutForm";
import { formatDayLong, guestsText, isPast, nightsText } from "./stayFormat";

const params = (query: string) => new URLSearchParams(query);

describe("stayFromParams", () => {
  it("lit arrivee / depart / voyageurs", () => {
    expect(stayFromParams(params("arrivee=2027-03-20&depart=2027-03-22&voyageurs=2"))).toEqual({ checkIn: "2027-03-20", checkOut: "2027-03-22", guests: 2 });
  });

  it("accepte les anciens paramètres ci / co / adults + children", () => {
    expect(stayFromParams(params("ci=2027-03-20&co=2027-03-22&adults=2&children=1"))).toEqual({ checkIn: "2027-03-20", checkOut: "2027-03-22", guests: 3 });
  });

  it("refuse dates invalides, départ avant arrivée et voyageurs hors bornes", () => {
    expect(stayFromParams(params("arrivee=2027-03-22&depart=2027-03-20&voyageurs=2"))).toBeNull();
    expect(stayFromParams(params("arrivee=2027-13-20&depart=2027-03-22&voyageurs=2"))).toBeNull();
    expect(stayFromParams(params("arrivee=2027-03-20&depart=2027-03-22&voyageurs=0"))).toBeNull();
    expect(stayFromParams(params("arrivee=2027-03-20&depart=2027-03-22&voyageurs=31"))).toBeNull();
    expect(stayFromParams(params("arrivee=2027-03-20&depart=2027-03-22"))).toBeNull();
  });

  it("la signature change avec les dates, les voyageurs et l’annonce", () => {
    const stay = { checkIn: "2027-03-20", checkOut: "2027-03-22", guests: 2 };
    expect(staySignature("a", stay)).toBe(staySignature("a", { ...stay }));
    expect(staySignature("a", stay)).not.toBe(staySignature("b", stay));
    expect(staySignature("a", stay)).not.toBe(staySignature("a", { ...stay, guests: 3 }));
  });
});

describe("libellés de réservation", () => {
  it("le français des statuts, issues et politiques reste identique à labels.ts", () => {
    for (const status of Object.keys(STATUS_KEYS) as (keyof typeof STATUS_KEYS)[]) {
      expect(DICT[STATUS_KEYS[status]].fr).toBe(BOOKING_STATUS_LABELS[status].label);
      expect(DICT[OUTCOME_KEYS[status].title].fr).toBe(BOOKING_OUTCOMES[status].title);
      expect(DICT[OUTCOME_KEYS[status].text].fr).toBe(BOOKING_OUTCOMES[status].text);
    }
    for (const policy of Object.keys(POLICY_KEYS) as (keyof typeof POLICY_KEYS)[]) {
      expect(DICT[POLICY_KEYS[policy].name].fr).toBe(POLICY_LABELS[policy].name.toLowerCase());
      expect(DICT[POLICY_KEYS[policy].text].fr).toBe(POLICY_LABELS[policy].text);
    }
  });

  it("l’état de paiement à finaliser n’emploie jamais le mot « confirmée »", () => {
    expect(DICT[STATUS_KEYS.pending_payment].fr).not.toMatch(/confirmé/i);
    expect(DICT[OUTCOME_KEYS.pending_payment.title].fr).not.toMatch(/confirmé/i);
  });
});

describe("format de séjour", () => {
  const t = (key: I18nKey, values: Record<string, string | number> = {}) =>
    Object.entries(values).reduce<string>((text, [name, value]) => text.replace(`{${name}}`, String(value)), DICT[key].fr);

  it("formate un jour dans la langue demandée, en UTC", () => {
    expect(formatDayLong("2027-03-20", "fr")).toBe("20 mars 2027");
    expect(formatDayLong("2027-03-20", "en")).toBe("20 March 2027");
    expect(formatDayLong("pas-un-jour", "fr")).toBe("pas-un-jour");
  });

  it("accorde nuits et voyageurs", () => {
    expect(nightsText(t, 1)).toBe("1 nuit");
    expect(nightsText(t, 3)).toBe("3 nuits");
    expect(guestsText(t, 1)).toBe("1 voyageur");
    expect(guestsText(t, 2)).toBe("2 voyageurs");
  });

  it("détecte un horodatage échu", () => {
    const now = new Date("2027-01-10T10:00:00Z");
    expect(isPast("2027-01-01T10:30:00+00:00", now)).toBe(true);
    expect(isPast("2027-01-10T10:30:00+00:00", now)).toBe(false);
    expect(isPast("n'importe quoi", now)).toBe(false);
  });
});
