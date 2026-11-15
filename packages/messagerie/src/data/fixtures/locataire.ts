import type { MessagerieSeed } from '../seed';
import { conversation, file, msg, person } from './builders';
import { pastSupportTicket, standardSupport, standardTicketBaseline, supportAgent } from './clientTickets';

const me = person('u-koffi', 'Koffi Adjovi', 'locataire', 'Apt A1, Les Tilleuls');
const gestion = person('g-tilleuls', 'Gestion Les Tilleuls', 'gestionnaire');

export function locataireSeed(): MessagerieSeed {
  return {
    me,
    conversations: [
      conversation({
        id: 'c-virement',
        subject: 'Merci de confirmer le virement avant le 20 novembre',
        counterpart: gestion,
        me,
        unread: true,
        awaitingReply: true,
        context: [
          { label: 'Avec', value: 'Gestion Les Tilleuls' },
          { label: 'Bail', value: 'Apt A1, Les Tilleuls' },
        ],
        links: [{ kind: 'bail', label: 'Ouvrir mon bail', href: '/bail' }],
        messages: [
          msg('m1', gestion.id, '2026-11-08T09:15:00+01:00', 'Bonjour M. Adjovi, nous n’avons pas reçu le loyer de novembre, soit 850 €. Pouvez-vous régulariser ?'),
          msg('m2', me.id, '2026-11-09T18:40:00+01:00', 'Bonjour, je règle novembre le 15/11. Désolé pour ce retard.'),
          msg('m3', gestion.id, '2026-11-11T10:05:00+01:00', 'Merci de confirmer le virement avant le 20 novembre, afin d’éviter des frais de relance. Cordialement.'),
        ],
      }),
      conversation({
        id: 'c-relance',
        subject: 'Relance, loyer de novembre',
        counterpart: gestion,
        me,
        context: [{ label: 'Avec', value: 'Gestion Les Tilleuls' }, { label: 'Bail', value: 'Apt A1, Les Tilleuls' }],
        messages: [msg('m1', gestion.id, '2026-11-08T08:30:00+01:00', 'Premier rappel : le loyer de novembre n’a pas été reçu à ce jour.')],
      }),
      conversation({
        id: 'c-fuite',
        subject: 'Fuite sous l’évier, photos jointes',
        counterpart: gestion,
        me,
        context: [{ label: 'Avec', value: 'Gestion Les Tilleuls' }, { label: 'Bail', value: 'Apt A1, Les Tilleuls' }],
        links: [{ kind: 'intervention', label: 'Voir l’intervention', href: '/interventions/INT-2026-0147' }],
        messages: [
          msg('m1', me.id, '2026-11-03T19:02:00+01:00', 'Bonjour, il y a une fuite sous l’évier de la cuisine. Je joins deux photos.', {
            attachments: [file('a1', 'evier-1.jpg', 1_468_006, 'image/jpeg'), file('a2', 'evier-2.jpg', 1_212_416, 'image/jpeg')],
          }),
        ],
      }),
      conversation({
        id: 'c-assurance',
        subject: 'Attestation d’assurance 2026',
        counterpart: gestion,
        me,
        context: [{ label: 'Avec', value: 'Gestion Les Tilleuls' }, { label: 'Bail', value: 'Apt A1, Les Tilleuls' }],
        messages: [
          msg('m1', me.id, '2026-03-28T14:10:00+01:00', 'Voici mon attestation d’assurance pour 2026.', {
            attachments: [file('a1', 'attestation-assurance-2026.pdf', 204_800, 'application/pdf')],
          }),
        ],
      }),
      conversation({
        id: 'c-regularisation',
        subject: 'Régularisation des charges 2025',
        counterpart: gestion,
        me,
        context: [{ label: 'Avec', value: 'Gestion Les Tilleuls' }, { label: 'Bail', value: 'Apt A1, Les Tilleuls' }],
        messages: [msg('m1', gestion.id, '2026-03-12T10:00:00+01:00', 'La régularisation des charges 2025 est disponible dans Loyers et quittances.')],
      }),
    ],
    recipients: [{ ...gestion, linkOptions: [] }],
    audiences: [],
    campaigns: [],
    tickets: [pastSupportTicket(me, 'Espace locataire')],
    staff: [{ id: supportAgent.id, name: supportAgent.name }],
    help: {
      categories: [
        {
          id: 'faq',
          title: 'Questions fréquentes',
          articles: [
            { id: 'payer', question: 'Comment payer mon loyer ?', answer: 'Depuis Loyers et quittances, choisissez Payer, puis la carte, le virement ou le prélèvement SEPA.', href: '/loyers', hrefLabel: 'Ouvrir Loyers et quittances' },
            { id: 'quittances', question: 'Où trouver mes quittances ?', answer: 'Elles sont dans Loyers et quittances et dans Documents, dès que le loyer du mois est soldé.' },
            { id: 'fuite', question: 'Que faire en cas de fuite ?', answer: 'Coupez l’arrivée d’eau, puis utilisez Signaler un problème en joignant des photos.', href: '/interventions/nouvelle', hrefLabel: 'Signaler un problème' },
            { id: 'conge', question: 'Comment donner congé ?', answer: 'Depuis Mon bail, choisissez Donner congé. Le préavis est d’un mois en zone tendue.' },
            { id: 'assurance', question: 'Comment renouveler mon attestation d’assurance ?', answer: 'Dans Assurance, déposez la nouvelle attestation avant le 31/03/2027.' },
            { id: 'depot', question: 'Comment récupérer mon dépôt de garantie ?', answer: 'Il est restitué après l’état des lieux de sortie, dans un délai d’un mois si tout est conforme.' },
          ],
        },
      ],
      contactTitle: 'Contacter le gestionnaire',
      contact: [
        { label: 'Gestionnaire', value: 'Gestion Les Tilleuls' },
        { label: 'Téléphone', value: '01 00 00 00 10' },
        { label: 'E-mail', value: 'gestion@example.com' },
        { label: 'Horaires', value: 'Lun. à ven., 9 h à 18 h' },
      ],
      emergencyTitle: 'En cas d’urgence',
      emergency: [
        { label: 'Fuite, panne', value: '01 00 00 00 10' },
        { label: 'Pompiers', value: '18' },
        { label: 'SAMU', value: '15' },
      ],
    },
    inbox: { staleCount: 0, staleDetail: null, averageReplyLabel: '3 h' },
    ticketBaseline: standardTicketBaseline,
    support: standardSupport,
  };
}
