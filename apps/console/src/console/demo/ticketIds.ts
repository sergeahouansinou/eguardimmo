import { demoSeeds } from '@eguardimmo/messagerie';

export function ticketIds(): { id: string }[] {
  return demoSeeds.console().tickets.map((ticket) => ({ id: ticket.id }));
}
