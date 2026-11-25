import { isIsoDay, nightsBetween } from "@/lib/dates";
import type { OccupiedRange } from "./schemas";

export type StayProblem = "incomplete" | "order" | "past" | "minNights" | "guests" | "occupied";

export interface StayCheckInput {
  checkIn: string;
  checkOut: string;
  guests: number;
  capacity: number;
  minNights: number | null;
  occupied: readonly OccupiedRange[];
  today: string;
}

export type StayCheck = { ok: true; nights: number } | { ok: false; problem: StayProblem; message: string | null };

export function overlapsOccupied(checkIn: string, checkOut: string, occupied: readonly OccupiedRange[]): boolean {
  return occupied.some((range) => checkIn < range.to && range.from < checkOut);
}

export function checkStay(input: StayCheckInput): StayCheck {
  const { checkIn, checkOut, guests, capacity, minNights, occupied, today } = input;
  if (!isIsoDay(checkIn) || !isIsoDay(checkOut)) return { ok: false, problem: "incomplete", message: null };
  if (checkIn < today) return { ok: false, problem: "past", message: "L’arrivée ne peut pas être dans le passé." };
  if (checkOut <= checkIn) return { ok: false, problem: "order", message: "Le départ doit suivre l’arrivée." };
  const nights = nightsBetween(checkIn, checkOut);
  if (minNights !== null && nights < minNights) {
    return { ok: false, problem: "minNights", message: `Séjour minimum : ${String(minNights)} nuits.` };
  }
  if (!Number.isInteger(guests) || guests < 1 || guests > capacity) {
    return { ok: false, problem: "guests", message: `Ce logement accueille de 1 à ${String(capacity)} voyageurs.` };
  }
  if (overlapsOccupied(checkIn, checkOut, occupied)) {
    return { ok: false, problem: "occupied", message: "Ces dates ne sont pas disponibles. Choisissez d’autres dates." };
  }
  return { ok: true, nights };
}

export function reservationHref(ref: string, stay: { checkIn: string; checkOut: string; guests: number }): string {
  const params = new URLSearchParams({ arrivee: stay.checkIn, depart: stay.checkOut, voyageurs: String(stay.guests) });
  return `/listings/${ref}/reserve?${params.toString()}`;
}
