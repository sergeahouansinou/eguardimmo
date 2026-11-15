import type { Campaign, CampaignAudience } from '../schemas';
import type { MessagerieSeed } from '../seed';
import { conversation, file, msg, person } from './builders';
import { pastSupportTicket, standardSupport, standardTicketBaseline, supportAgent } from './clientTickets';

const me = person('u-sophie', 'Sophie Delmas', 'agence', 'Cabinet Delmas Immobilier');
const anais = person('t-anais', 'Anaïs Roux', 'locataire', 'Studio 4');
const marc = person('m-marc', 'Marc Chevalier', 'mandant', 'SCI Chevalier');
const louis = person('t-louis', 'Louis Petit', 'locataire', 'Apt 7');
const helene = person('m-helene', 'Hélène Roussel', 'mandant', 'Particulier');
const bernard = person('m-bernard', 'Famille Bernard', 'mandant', 'Indivision');
const sarah = person('t-sarah', 'Sarah Mensah', 'locataire', 'Lot 3');
const paul = person('m-paul', 'Paul Lemoine', 'mandant', 'Particulier');
const nadia = person('m-nadia', 'Nadia Benali', 'mandant', 'Particulier');
const acacias = person('m-acacias', 'SCI Les Acacias', 'mandant', 'Société civile');

const campaignBody = (title: string) => `Bonjour {Prénom},\n\n${title}\n\nCordialement,\nCabinet Delmas Immobilier`;

function campaign(
  id: string,
  title: string,
  audience: { id: string; label: string },
  recipientCount: number,
  status: Campaign['status'],
  extra: Partial<Campaign> = {},
): Campaign {
  return {
    id,
    title,
    audienceId: audience.id,
    audienceLabel: audience.label,
    buildingIds: [],
    recipientCount,
    status,
    sentAt: null,
    scheduledAt: null,
    readCount: null,
    failedCount: 0,
    subject: title,
    body: campaignBody(title),
    ...extra,
  };
}

export const agenceAudiences: CampaignAudience[] = [
  { id: 'aud-locataires', label: 'Tous les locataires', detail: 'Baux en cours', count: 12, withoutEmail: 1 },
  { id: 'aud-tilleuls', label: 'Un ou plusieurs immeubles', detail: 'Les Tilleuls', count: 6, withoutEmail: 0 },
  { id: 'aud-mandants', label: 'Tous les mandants', detail: 'Mandats en cours', count: 6, withoutEmail: 0 },
  { id: 'aud-impayes', label: 'Locataires avec un impayé', detail: 'Solde négatif au 13/11/2026', count: 3, withoutEmail: 0 },
];

export function agenceSeed(): MessagerieSeed {
  const tilleuls = { id: 'aud-tilleuls', label: 'Les Tilleuls' };
  const mandants = { id: 'aud-mandants', label: 'Tous les mandants' };
  return {
    me,
    conversations: [
      conversation({
        id: 'c-anais',
        subject: 'La fuite sous l’évier s’aggrave, photo jointe',
        counterpart: anais,
        me,
        tag: 'Studio 4',
        unread: true,
        awaitingReply: true,
        context: [
          { label: 'Bien', value: 'Studio 4' },
          { label: 'Mandant', value: 'Marc Chevalier' },
          { label: 'Mandat', value: 'M-2025-0142' },
          { label: 'Loyer', value: '450 €, impayé 12 jours' },
          { label: 'Intervention', value: 'Fuite, urgente' },
        ],
        links: [
          { kind: 'bail', label: 'Ouvrir le bail', href: '/baux/b-2026-007' },
          { kind: 'intervention', label: 'Voir l’intervention', href: '/interventions/fuite-sous-l-evier' },
        ],
        messages: [
          msg('m1', anais.id, '2026-11-11T18:02:00+01:00', 'Bonjour, il y a une fuite sous l’évier de la cuisine depuis hier soir. J’ai posé une bassine.'),
          msg('m2', me.id, '2026-11-12T09:14:00+01:00', 'Bonjour Anaïs, merci du signalement. Pouvez-vous nous envoyer une photo ? Nous faisons venir un plombier.'),
          msg('m3', anais.id, '2026-11-12T09:30:00+01:00', 'Photo de la fuite.', { attachments: [file('a1', 'evier-fuite.jpg', 1_468_006, 'image/jpeg')] }),
          msg('m4', anais.id, '2026-11-13T08:40:00+01:00', 'La fuite s’aggrave, l’eau coule maintenant sur le meuble. Quand passe le plombier ?'),
        ],
      }),
      conversation({
        id: 'c-marc',
        subject: 'Pouvez-vous confirmer la date du reversement de novembre ?',
        counterpart: marc,
        me,
        tag: 'SCI Chevalier',
        unread: true,
        awaitingReply: true,
        context: [{ label: 'Mandant', value: 'Marc Chevalier' }, { label: 'Mandat', value: 'M-2025-0142' }],
        links: [{ kind: 'mandat', label: 'Ouvrir le mandat', href: '/mandats/m-2025-0142' }],
        messages: [msg('m1', marc.id, '2026-11-13T07:55:00+01:00', 'Pouvez-vous confirmer la date du reversement de novembre ?')],
      }),
      conversation({
        id: 'c-louis',
        subject: 'Virement envoyé hier, merci de confirmer la réception',
        counterpart: louis,
        me,
        tag: 'Apt 7',
        unread: true,
        awaitingReply: true,
        messages: [msg('m1', louis.id, '2026-11-12T18:20:00+01:00', 'Virement envoyé hier, merci de confirmer la réception.')],
      }),
      conversation({
        id: 'c-helene',
        subject: 'Renouvellement du mandat M-2023-0071',
        counterpart: helene,
        me,
        tag: 'Particulier',
        unread: true,
        awaitingReply: true,
        links: [{ kind: 'mandat', label: 'Ouvrir le mandat', href: '/mandats/m-2023-0071' }],
        messages: [msg('m1', helene.id, '2026-11-12T11:05:00+01:00', 'Je souhaite renouveler le mandat M-2023-0071. Que dois-je faire ?')],
      }),
      conversation({
        id: 'c-bernard',
        subject: 'Merci pour le compte rendu d’octobre',
        counterpart: bernard,
        me,
        tag: 'Indivision',
        messages: [msg('m1', bernard.id, '2026-11-10T16:30:00+01:00', 'Merci pour le compte rendu d’octobre.')],
      }),
      conversation({
        id: 'c-sarah',
        subject: 'Attestation d’assurance en pièce jointe',
        counterpart: sarah,
        me,
        tag: 'Lot 3',
        messages: [msg('m1', sarah.id, '2026-11-09T09:12:00+01:00', 'Voici mon attestation d’assurance.', { attachments: [file('a1', 'attestation.pdf', 187_392, 'application/pdf')] })],
      }),
      conversation({
        id: 'c-paul',
        subject: 'Date du prochain état des lieux de sortie',
        counterpart: paul,
        me,
        tag: 'Particulier',
        messages: [msg('m1', paul.id, '2026-11-06T14:48:00+01:00', 'Quelle est la date du prochain état des lieux de sortie ?')],
      }),
      conversation({
        id: 'c-nadia',
        subject: 'Question sur la déclaration des revenus fonciers',
        counterpart: nadia,
        me,
        tag: 'Particulier',
        messages: [msg('m1', nadia.id, '2026-11-04T10:02:00+01:00', 'J’ai une question sur la déclaration des revenus fonciers.')],
      }),
      conversation({
        id: 'c-acacias',
        subject: 'Autorisation de travaux sur les parties communes',
        counterpart: acacias,
        me,
        tag: 'Société civile',
        messages: [msg('m1', acacias.id, '2026-11-03T15:21:00+01:00', 'Nous autorisons les travaux sur les parties communes.')],
      }),
    ],
    recipients: [
      { ...marc, detail: 'mandant (SCI Chevalier)', linkOptions: [{ id: 'mandat-0142', label: 'Mandat M-2025-0142, Studio 4' }] },
      { ...helene, linkOptions: [{ id: 'mandat-0071', label: 'Mandat M-2023-0071' }] },
      { ...bernard, linkOptions: [] },
      { ...paul, linkOptions: [] },
      { ...nadia, linkOptions: [] },
      { ...acacias, linkOptions: [] },
      { ...anais, detail: 'locataire (Studio 4)', linkOptions: [{ id: 'bail-studio4', label: 'Bail du Studio 4' }] },
      { ...louis, detail: 'locataire (Apt 7)', linkOptions: [{ id: 'bail-apt7', label: 'Bail de l’Apt 7' }] },
      { ...sarah, detail: 'locataire (Lot 3)', linkOptions: [] },
    ],
    audiences: agenceAudiences,
    campaigns: [
      campaign('camp-eau', 'Coupure d’eau lundi 16 novembre', tilleuls, 6, 'envoyee', { sentAt: '2026-11-13T09:10:00+01:00', readCount: 5 }),
      campaign('camp-reversements', 'Calendrier des reversements de novembre', mandants, 6, 'programmee', { scheduledAt: '2026-11-25T08:00:00+01:00' }),
      campaign('camp-assurance', 'Attestation d’assurance à renouveler', { id: 'aud-impayes', label: 'Locataires concernés' }, 2, 'envoyee', { sentAt: '2026-11-05T10:30:00+01:00', readCount: 2 }),
      campaign('camp-adresse', 'Nouvelle adresse de paiement', { id: 'aud-locataires', label: 'Tous les locataires' }, 12, 'envoyee', { sentAt: '2026-10-02T09:00:00+02:00', readCount: 11, failedCount: 1 }),
      campaign('camp-fermeture', 'Fermeture du cabinet en décembre', mandants, 6, 'brouillon'),
    ],
    tickets: [pastSupportTicket(me, 'Cabinet Delmas Immobilier')],
    staff: [{ id: supportAgent.id, name: supportAgent.name }],
    help: {
      categories: [
        {
          id: 'mandats',
          title: 'Mandats et mandants',
          articles: [
            { id: 'creer-mandat', question: 'Comment créer un nouveau mandat ?', answer: 'Depuis Mandats, choisissez Nouveau mandat, indiquez le mandant et les lots, puis envoyez le mandat à la signature électronique. Il entre dans le registre dès sa signature.' },
            { id: 'renouveler', question: 'Comment renouveler un mandat qui expire ?', answer: 'Ouvrez la fiche du mandat et choisissez Renouveler : les conditions sont reprises et envoyées à la signature du mandant.' },
            { id: 'devis-refuse', question: 'Que faire quand un mandant refuse un devis ?', answer: 'Le refus est consigné dans le dossier de l’intervention. Proposez un second devis ou clôturez l’intervention depuis sa fiche.' },
          ],
        },
        {
          id: 'finances',
          title: 'Reversements et honoraires',
          articles: [
            { id: 'honoraires', question: 'Comment sont calculés mes honoraires ?', answer: 'Selon le barème défini dans Réglages, finances et honoraires, appliqué aux loyers réellement encaissés.' },
            { id: 'reversements', question: 'Quand les reversements sont-ils effectués ?', answer: 'À la date fixée dans les réglages (par défaut le 5 du mois), après le rapprochement des encaissements.' },
            { id: 'impaye', question: 'Que faire en cas de loyer impayé ?', answer: 'Depuis Impayés, relancez le locataire avec un modèle de courrier ; le reversement ne porte que sur les loyers encaissés.' },
          ],
        },
        {
          id: 'equipe',
          title: 'Équipe et sécurité',
          articles: [
            { id: 'inviter', question: 'Comment inviter un collaborateur ?', answer: 'Dans Équipe, choisissez Inviter un collaborateur, indiquez son e-mail et son rôle. Il reçoit un lien d’activation.' },
            { id: 'conformite', question: 'Où retrouver mes attestations de conformité ?', answer: 'Dans Conformité : chaque obligation (carte professionnelle, garantie financière, assurance) a sa fiche et ses pièces.' },
          ],
        },
      ],
      contactTitle: 'Contacter le support',
      contact: [
        { label: 'E-mail', value: 'support@eguardimmo.example' },
        { label: 'Téléphone', value: '+33 1 00 00 00 00' },
        { label: 'Horaires', value: 'Lundi au vendredi, 9 h à 18 h' },
      ],
      emergencyTitle: null,
      emergency: [],
    },
    inbox: { staleCount: 1, staleDetail: 'Louis Petit, Apt 7', averageReplyLabel: '3 h' },
    ticketBaseline: standardTicketBaseline,
    support: standardSupport,
  };
}
