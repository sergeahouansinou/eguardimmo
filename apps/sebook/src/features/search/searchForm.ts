import { z } from "zod";
import { addDays, isIsoDay, todayIso } from "@/lib/dates";

export interface SearchFormValues {
  destination: string;
  checkIn: string;
  checkOut: string;
  guests: string;
}

export interface SearchFormErrors {
  checkIn?: string;
  checkOut?: string;
  guests?: string;
}

const guestsSchema = z.coerce.number().int().min(1).max(30);

export function validateSearchForm(values: SearchFormValues, shortStay: boolean, today: string = todayIso()): SearchFormErrors {
  const errors: SearchFormErrors = {};
  if (values.guests.trim() !== "" && !guestsSchema.safeParse(values.guests).success) errors.guests = "Indiquez un nombre de voyageurs entre 1 et 30.";
  if (!shortStay) return errors;
  const hasIn = values.checkIn !== "";
  const hasOut = values.checkOut !== "";
  if (hasIn !== hasOut) {
    if (hasIn) errors.checkOut = "Indiquez la date de départ.";
    else errors.checkIn = "Indiquez la date d’arrivée.";
    return errors;
  }
  if (!hasIn) return errors;
  if (!isIsoDay(values.checkIn)) errors.checkIn = "Date d’arrivée invalide.";
  else if (values.checkIn < today) errors.checkIn = "L’arrivée ne peut pas être dans le passé.";
  if (!isIsoDay(values.checkOut)) errors.checkOut = "Date de départ invalide.";
  else if (!errors.checkIn && values.checkOut <= values.checkIn) errors.checkOut = "Le départ doit suivre l’arrivée.";
  return errors;
}

export function minCheckOut(checkIn: string, today: string = todayIso()): string {
  return isIsoDay(checkIn) ? addDays(checkIn, 1) : addDays(today, 1);
}
