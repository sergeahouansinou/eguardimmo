import type { MessagerieSeed } from '../seed';
import { conversation, msg, person } from './builders';
import { pastSupportTicket, standardSupport, standardTicketBaseline, supportAgent } from './clientTickets';
import { agenceSeed } from './agence';
import type { Campaign } from '../schemas';

const me = person('u-marc-b', 'Marc Chevalier', 'bailleur', 'Gestion Les Tilleuls');
const koffi = person('t-koffi', 'Koffi Adjovi', 'locataire', 'Apt A1');
const ibrahim = person('t-ibrahim', 'Ibrahim Yao', 'locataire', 'Studio 2e');
const dossou = person('t-dossou', 'Marc Dossou', 'locataire', 'Villa RDC');

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
    recipientCount,
    status,
    sentAt: null,
    scheduledAt: null,
    readCount: null,
    failedCount: 0,
    subject: title,
    body: `Bonjour {Prénom},\n\n${title}\n\nCordialement,\nGestion Les Tilleuls`,
    ...extra,
  };
}

export function bailleurSeed(): MessagerieSeed {
  const agence = agenceSeed();
  const locataires = { id: 'aud-locataires', label: 'Tous les locataires' };
  return {
    me,
    conversations: [
      conversation({
        id: 'c-koffi',
        subject: 'Quand payez-vous le loyer ?',
        counterpart: koffi,
        me,
        tag: 'Apt A1',
        unread: true,
        awaitingReply: true,
        context: [{ label: 'Bien', value: 'Apt A1, Les Tilleuls' }, { label: 'Bail', value: 'Bail en cours' }],
        links: [{ kind: 'bail', label: 'Ouvrir le bail', href: '/baux/apt-a1' }],
        messages: [
          msg('m1', koffi.id, '2026-11-10T18:02:00+01:00', 'Bonjour, le loyer de novembre sera-t-il versé cette semaine ?'),
          msg('m2', me.id, '2026-11-11T09:14:00+01:00', 'Bonjour Koffi, merci de confirmer le virement avant le 20 novembre.'),
          msg('m3', koffi.id, '2026-11-13T08:40:00+01:00', 'Quand payez-vous le loyer ?'),
        ],
      }),
      conversation({
        id: 'c-ibrahim',
        subject: 'Merci pour l’état des lieux',
        counterpart: ibrahim,
        me,
        tag: 'Studio 2e',
        unread: true,
        context: [{ label: 'Bien', value: 'Studio 2e, Résidence du Parc' }, { label: 'Bail', value: 'Préavis en cours' }],
        links: [{ kind: 'bail', label: 'Ouvrir le bail', href: '/baux/studio-2e' }],
        messages: [msg('m1', ibrahim.id, '2026-11-12T10:20:00+01:00', 'Merci pour l’état des lieux.')],
      }),
      conversation({
        id: 'c-dossou',
        subject: 'Le chauffe-eau fonctionne à nouveau',
        counterpart: dossou,
        me,
        tag: 'Villa RDC',
        context: [{ label: 'Bien', value: 'Villa RDC, Maison Rivière' }, { label: 'Bail', value: 'Bail en cours' }],
        links: [
          { kind: 'bail', label: 'Ouvrir le bail', href: '/baux/villa-rdc' },
          { kind: 'intervention', label: 'Voir l’intervention', href: '/interventions/chauffe-eau-a-remplacer' },
        ],
        messages: [msg('m1', dossou.id, '2026-11-09T17:45:00+01:00', 'Le chauffe-eau fonctionne à nouveau.')],
      }),
    ],
    recipients: [
      { ...koffi, linkOptions: [{ id: 'bail-a1', label: 'Bail de l’Apt A1' }] },
      { ...ibrahim, linkOptions: [{ id: 'bail-studio-2e', label: 'Bail du Studio 2e' }] },
      { ...dossou, linkOptions: [{ id: 'bail-villa-rdc', label: 'Bail de la Villa RDC' }] },
    ],
    audiences: [
      { id: 'aud-locataires', label: 'Tous les locataires', detail: 'Baux en cours', count: 10, withoutEmail: 1 },
      { id: 'aud-tilleuls', label: 'Un ou plusieurs immeubles', detail: 'Les Tilleuls', count: 6, withoutEmail: 0 },
      { id: 'aud-impayes', label: 'Locataires avec un impayé', detail: 'Solde négatif au 13/11/2026', count: 3, withoutEmail: 0 },
    ],
    campaigns: [
      campaign('camp-eau', 'Coupure d’eau, lundi 16 novembre', { id: 'aud-tilleuls', label: 'Les Tilleuls' }, 6, 'envoyee', { sentAt: '2026-11-13T09:10:00+01:00', readCount: 5 }),
      campaign('camp-revision', 'Révision des loyers au 1er décembre', locataires, 10, 'programmee', { scheduledAt: '2026-11-25T08:00:00+01:00' }),
      campaign('camp-assurance', 'Attestation d’assurance à renouveler', { id: 'aud-impayes', label: 'Locataires concernés' }, 2, 'envoyee', { sentAt: '2026-11-05T10:30:00+01:00', readCount: 2 }),
      campaign('camp-adresse', 'Nouvelle adresse de paiement', locataires, 10, 'envoyee', { sentAt: '2026-10-02T09:00:00+02:00', readCount: 8, failedCount: 1 }),
      campaign('camp-fermeture', 'Fermeture du bureau en décembre', locataires, 10, 'brouillon'),
    ],
    tickets: [pastSupportTicket(me, 'Espace bailleur')],
    staff: [{ id: supportAgent.id, name: supportAgent.name }],
    help: {
      categories: [
        {
          id: 'faq',
          title: 'Questions fréquentes',
          articles: [
            { id: 'loyer', question: 'Comment enregistrer un loyer encaissé ?', answer: 'Depuis Finances, choisissez Encaisser un loyer, sélectionnez le bail et saisissez le montant reçu. La quittance se génère une fois le loyer soldé.' },
            { id: 'relance', question: 'Comment relancer un locataire en retard ?', answer: 'Depuis Impayés, ouvrez le dossier puis envoyez un message ou une campagne aux locataires concernés.' },
            { id: 'campagne', question: 'Comment écrire à plusieurs locataires ?', answer: 'Créez une campagne : chaque locataire reçoit le message à part et vous suivez la lecture.' },
            { id: 'raccourcis', question: 'Existe-t-il des raccourcis clavier ?', answer: 'Oui : ⌘ K ou Ctrl K ouvre la recherche, ? affiche la liste complète des raccourcis.', href: '/aide/raccourcis', hrefLabel: 'Voir les raccourcis' },
            { id: 'probleme', question: 'Comment signaler un problème ?', answer: 'Décrivez ce qui s’est passé depuis la page de signalement : le support reçoit votre demande avec le contexte.', href: '/aide/signaler', hrefLabel: 'Signaler un problème' },
          ],
        },
      ],
      contactTitle: 'Contacter le support',
      contact: agence.help.contact,
      emergencyTitle: null,
      emergency: [],
    },
    inbox: { staleCount: 0, staleDetail: null, averageReplyLabel: '3 h' },
    ticketBaseline: standardTicketBaseline,
    support: standardSupport,
  };
}
