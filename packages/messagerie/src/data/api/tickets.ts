import { unavailable } from './shared';

export const TICKETS_UNAVAILABLE_MESSAGE = 'Le support passe par son module dédié : cette lecture n’est pas disponible ici.';

export function ticketHandlers() {
  const gone = unavailable(TICKETS_UNAVAILABLE_MESSAGE);
  return {
    listTickets: gone,
    ticketStats: gone,
    getTicket: gone,
    listStaff: gone,
    updateTicket: gone,
    replyToTicket: gone,
    requestTicketAccess: gone,
    listMyTickets: gone,
    getMyTicket: gone,
    createSupportTicket: gone,
    replyToMyTicket: gone,
  };
}
