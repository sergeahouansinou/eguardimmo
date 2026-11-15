import type { Participant, TicketDetail } from '../schemas';
import { msg, person, ticket } from './builders';

export const supportAgent = person('op-ines', 'Inès Garnier', 'operateur', 'Support eGuardImmo');

export function pastSupportTicket(me: Participant, organization: string): TicketDetail {
  return ticket(
    {
      id: `tk-${me.id}-0412`,
      reference: 'SUP-2041',
      subject: 'Je ne retrouve pas mes documents',
      organization,
      requester: me,
      assignee: { id: supportAgent.id, name: supportAgent.name },
      priority: 'normale',
      status: 'resolu',
      category: 'documents',
      createdAt: '2026-10-02T10:15:00+02:00',
      participants: [me, supportAgent],
      firstResponseLabel: '18 min',
      messages: [
        msg('m1', me.id, '2026-10-02T10:15:00+02:00', 'Bonjour, je ne retrouve plus mes documents dans mon espace.'),
        msg(
          'm2',
          supportAgent.id,
          '2026-10-02T10:33:00+02:00',
          'Bonjour, ils sont dans la rubrique Documents, filtre « Tous les ans ». Dites-moi si vous ne les voyez toujours pas.',
        ),
        msg(
          'm3',
          supportAgent.id,
          '2026-10-02T10:34:00+02:00',
          'Note : filtre d’année réinitialisé après mise à jour.',
          { internal: true },
        ),
        msg('m4', me.id, '2026-10-02T11:02:00+02:00', 'Je les vois, merci.'),
      ],
    },
    me.id,
  );
}

export const standardSupport = {
  hoursLabel: 'Lundi au vendredi, 9 h à 18 h',
  responseLabel: 'Réponse en général sous 2 heures',
};

export const standardTicketBaseline = {
  firstResponse: '2 h 10',
  firstResponseDetail: 'Moyenne sur 30 jours',
  resolved30d: 41,
  satisfaction: 'Satisfaction : 94 %',
};
