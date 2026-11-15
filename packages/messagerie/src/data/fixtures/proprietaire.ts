import type { MessagerieSeed } from '../seed';
import { conversation, msg, person } from './builders';
import { pastSupportTicket, standardSupport, standardTicketBaseline, supportAgent } from './clientTickets';

const me = person('u-marc', 'Marc Chevalier', 'proprietaire', 'SCI Chevalier');
const sophie = person('g-sophie', 'Sophie Delmas', 'gestionnaire', 'Cabinet Delmas Immobilier');

const base = { counterpart: sophie, me };

export function proprietaireSeed(): MessagerieSeed {
  return {
    me,
    conversations: [
      conversation({
        ...base,
        id: 'c-devis',
        subject: 'Devis de plomberie, Studio 4',
        unread: true,
        context: [{ label: 'Gestionnaire', value: 'Sophie Delmas' }, { label: 'Mandat', value: 'M-2025-0142' }],
        links: [{ kind: 'devis', label: 'Voir le devis', href: '/interventions/fuite-sous-l-evier/devis' }],
        messages: [
          msg('m1', sophie.id, '2026-11-12T16:20:00+01:00', 'Bonjour Monsieur Chevalier, une fuite sous l’évier du Studio 4 a été signalée le 10/11. Le plombier propose un devis de 380 € TTC. Ce montant dépasse le seuil de 300 € prévu au mandat : votre accord est nécessaire.'),
          msg('m2', me.id, '2026-11-12T18:05:00+01:00', 'Bonjour, pouvez-vous me donner le détail du devis ?'),
          msg('m3', sophie.id, '2026-11-13T09:12:00+01:00', 'Le devis détaille 2 h de main-d’œuvre, le déplacement et les pièces (siphon, flexibles). Vous pouvez le valider depuis la page du devis.'),
        ],
      }),
      conversation({
        ...base,
        id: 'c-impaye',
        subject: 'Impayé du Studio 4',
        messages: [msg('m1', sophie.id, '2026-11-10T11:00:00+01:00', 'Une relance a été envoyée le 08/11/2026.')],
      }),
      conversation({
        ...base,
        id: 'c-reversement',
        subject: 'Reversement d’octobre',
        messages: [
          msg('m1', sophie.id, '2026-11-05T09:00:00+01:00', 'Le reversement d’octobre a été émis ce matin.'),
          msg('m2', me.id, '2026-11-05T15:30:00+01:00', 'Merci, virement bien reçu.'),
        ],
      }),
      conversation({
        ...base,
        id: 'c-assurance',
        subject: 'Renouvellement de l’assurance propriétaire',
        messages: [msg('m1', sophie.id, '2026-10-28T10:10:00+01:00', 'Pouvez-vous déposer la nouvelle attestation ?')],
      }),
      conversation({
        ...base,
        id: 'c-cr',
        subject: 'Compte rendu de gestion, T3 2026',
        messages: [msg('m1', sophie.id, '2026-10-05T08:00:00+02:00', 'Le compte rendu est disponible dans votre espace.')],
      }),
      conversation({
        ...base,
        id: 'c-mandat',
        subject: 'Échéance du mandat',
        messages: [msg('m1', sophie.id, '2026-09-12T14:00:00+02:00', 'Le mandat se poursuit jusqu’au 31/12/2027.')],
      }),
    ],
    recipients: [{ ...sophie, linkOptions: [{ id: 'lot-apt12', label: 'Apt 12' }, { id: 'lot-studio4', label: 'Studio 4' }] }],
    audiences: [],
    campaigns: [],
    tickets: [pastSupportTicket(me, 'Espace propriétaire')],
    staff: [{ id: supportAgent.id, name: supportAgent.name }],
    help: {
      categories: [
        {
          id: 'faq',
          title: 'Questions fréquentes',
          articles: [
            { id: 'loyers', question: 'Quand reçois-je mes loyers ?', answer: 'L’agence vous reverse les loyers encaissés le 5 de chaque mois, par virement sur le compte indiqué dans Mes informations.' },
            { id: 'honoraires', question: 'Comment sont calculés les honoraires ?', answer: 'Ils sont de 7 % TTC des loyers encaissés, déduits du reversement. Sur 700 € encaissés, ils représentent 49,00 €.' },
            { id: 'impaye', question: 'Que se passe-t-il en cas d’impayé ?', answer: 'Le reversement est calculé sur les loyers réellement encaissés. L’agence relance le locataire et vous tient informé.' },
            { id: 'devis', question: 'Pourquoi mon accord est-il demandé pour un devis ?', answer: 'Le mandat prévoit votre accord pour toute intervention dépassant 300 € TTC. En dessous, l’agence agit seule.' },
            { id: 'fiscal', question: 'Où trouver mes documents fiscaux ?', answer: 'Le récapitulatif des revenus fonciers et l’aide à la déclaration 2044 sont dans la rubrique Fiscalité.', href: '/fiscalite', hrefLabel: 'Ouvrir Fiscalité' },
          ],
        },
      ],
      contactTitle: 'Contacter l’agence',
      contact: [
        { label: 'Gestionnaire', value: 'Sophie Delmas' },
        { label: 'Téléphone', value: '+33 4 00 00 00 03' },
        { label: 'E-mail', value: 'contact@delmas-immobilier.example' },
        { label: 'Horaires', value: 'Lun. au ven., 9 h à 18 h' },
      ],
      emergencyTitle: null,
      emergency: [],
    },
    inbox: { staleCount: 0, staleDetail: null, averageReplyLabel: '3 h' },
    ticketBaseline: standardTicketBaseline,
    support: standardSupport,
  };
}
