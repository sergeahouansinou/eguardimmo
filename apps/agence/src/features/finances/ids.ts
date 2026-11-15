import { LOTS, MANDANTS } from "@/features/shared/directory";

export function lotIds(): { id: string }[] {
  return LOTS.map((lot) => ({ id: lot.id }));
}

export function mandantIds(): { id: string }[] {
  return MANDANTS.map((mandant) => ({ id: mandant.id }));
}
