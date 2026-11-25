import { z } from "zod";
import { isIsoDay } from "@/lib/dates";

export interface Stay {
  checkIn: string;
  checkOut: string;
  guests: number;
}

const guests = z.coerce.number().int().min(1).max(30);

function guestsParam(params: { get: (name: string) => string | null }): string | null {
  const direct = params.get("voyageurs");
  if (direct !== null) return direct;
  const adults = params.get("adults");
  if (adults === null) return null;
  return String(Number(adults) + Number(params.get("children") ?? 0));
}

export function stayFromParams(params: { get: (name: string) => string | null }): Stay | null {
  const checkIn = params.get("arrivee") ?? params.get("ci") ?? "";
  const checkOut = params.get("depart") ?? params.get("co") ?? "";
  const parsed = guests.safeParse(guestsParam(params));
  if (!isIsoDay(checkIn) || !isIsoDay(checkOut) || checkOut <= checkIn || !parsed.success) return null;
  return { checkIn, checkOut, guests: parsed.data };
}

export function staySignature(publicRef: string, stay: Stay): string {
  return `${publicRef}|${stay.checkIn}|${stay.checkOut}|${String(stay.guests)}`;
}
