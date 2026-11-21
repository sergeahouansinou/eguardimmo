import type { Seats } from "./schemas";

function plural(count: number, one: string, many: string): string {
  return `${String(count)} ${count > 1 ? many : one}`;
}

export function seatMessage(seats: Seats): string {
  if (seats.limit === null) {
    return `Formule ${seats.planName} : ${plural(seats.active, "collaborateur actif", "collaborateurs actifs")}. Plusieurs collaborateurs inclus.`;
  }
  const head = `Formule ${seats.planName} : ${plural(seats.active, "collaborateur actif", "collaborateurs actifs")} sur ${String(seats.limit)}.`;
  const free = seats.limit - seats.used;
  if (seats.pending > 0 && free <= 0) {
    return seats.pending === 1
      ? `${head} L'invitation en attente occupera la dernière place.`
      : `${head} Les invitations en attente occuperont les dernières places.`;
  }
  if (seats.pending > 0) {
    return `${head} ${plural(seats.pending, "invitation en attente", "invitations en attente")}, ${plural(free, "place disponible", "places disponibles")}.`;
  }
  if (free <= 0) return `${head} Aucune place disponible.`;
  return `${head} ${plural(free, "place disponible", "places disponibles")}.`;
}
