import type { TicketDetail } from '../schemas';
import type { MessagerieSeed } from '../seed';
import { msg, person, ticket } from './builders';
import { standardSupport } from './clientTickets';

const ines = person('op-ines', 'Inès Garnier', 'operateur', 'Support eGuardImmo');
const theo = person('op-theo', 'Théo Marchand', 'operateur', 'Technique');
const julie = person('op-julie', 'Julie Fontaine', 'operateur', 'Exploitation');
const marc = person('c-marc', 'Marc Chevalier', 'bailleur', 'Gestion Les Tilleuls');
const sophie = person('c-sophie', 'Sophie Delmas', 'agence', 'Cabinet Delmas Immobilier');
const parc = person('c-parc', 'Claire Dubois', 'bailleur', 'Résidences du Parc');
const rhone = person('c-rhone', 'Paul Garnier', 'agence', 'Immo Rhône Gestion');

const staff = [ines, theo, julie];
const op = (assignee: typeof ines) => ({ id: assignee.id, name: assignee.name });

function tickets(): TicketDetail[] {
  const viewer = ines.id;
  return [
    {
      ...ticket(
        {
          id: 'tk-2094',
          reference: 'SUP-2094',
          subject: 'E-mails de relance non reçus par les locataires',
          organization: 'Gestion Les Tilleuls',
          requester: marc,
          assignee: op(ines),
          priority: 'haute',
          status: 'ouvert',
          category: 'messagerie',
          createdAt: '2026-11-13T21:02:00+01:00',
          participants: [marc, ines, theo],
          firstResponseLabel: '14 min, délai respecté',
          linked: [
            { id: 'inc-031', label: 'INC-2026-031', detail: 'Messagerie dégradée · en cours', tone: 'warning' },
            { id: 'sup-2091', label: 'SUP-2091', detail: 'Autre organisation, même module', tone: 'neutral' },
          ],
          messages: [
            msg('m1', marc.id, '2026-11-13T21:02:00+01:00', 'Bonjour, les relances d’impayé envoyées ce soir n’arrivent pas chez mes locataires. Dans l’application, elles apparaissent pourtant comme envoyées.'),
            msg('m2', ines.id, '2026-11-13T21:16:00+01:00', 'Bonjour Marc, nous avons identifié un ralentissement de la file d’envoi des e-mails. Vos relances sont conservées et partiront dès le retour à la normale. Nous revenons vers vous avant 23 h.'),
            msg('m3', theo.id, '2026-11-13T21:24:00+01:00', 'Worker d’e-mails saturé, limitation du débit à 200 messages par minute. 1 842 messages en attente.', { internal: true }),
          ],
        },
        viewer,
      ),
    },
    ticket(
      {
        id: 'tk-2093',
        reference: 'SUP-2093',
        subject: 'Export Excel des encaissements bloqué',
        organization: 'Résidences du Parc',
        requester: parc,
        assignee: op(theo),
        priority: 'normale',
        status: 'ouvert',
        category: 'documents',
        createdAt: '2026-11-13T17:55:00+01:00',
        participants: [parc, theo],
        firstResponseLabel: '45 min',
        messages: [
          msg('m1', parc.id, '2026-11-13T17:55:00+01:00', 'L’export Excel des encaissements reste bloqué à 80 %.'),
          msg('m2', theo.id, '2026-11-13T18:40:00+01:00', 'Bonjour, nous reproduisons le problème et revenons vers vous.'),
        ],
      },
      viewer,
    ),
    ticket(
      {
        id: 'tk-2091',
        reference: 'SUP-2091',
        subject: 'Ajout d’un utilisateur comptable',
        organization: 'Cabinet Delmas Immobilier',
        requester: sophie,
        priority: 'basse',
        status: 'ouvert',
        category: 'compte',
        createdAt: '2026-11-12T16:05:00+01:00',
        participants: [sophie],
        messages: [msg('m1', sophie.id, '2026-11-12T16:05:00+01:00', 'Pouvez-vous ajouter un utilisateur comptable à notre espace ?')],
      },
      viewer,
    ),
    ticket(
      {
        id: 'tk-2088',
        reference: 'SUP-2088',
        subject: 'Double authentification perdue, nouveau téléphone',
        organization: 'Gestion Les Tilleuls',
        requester: marc,
        assignee: op(ines),
        priority: 'haute',
        status: 'ouvert',
        category: 'compte',
        createdAt: '2026-11-12T09:10:00+01:00',
        participants: [marc, ines],
        firstResponseLabel: '12 min',
        messages: [
          msg('m1', marc.id, '2026-11-12T09:10:00+01:00', 'J’ai changé de téléphone et je ne peux plus valider ma double authentification.'),
          msg('m2', ines.id, '2026-11-12T09:22:00+01:00', 'Bonjour, nous allons vérifier votre identité puis réinitialiser la double authentification.'),
        ],
      },
      viewer,
    ),
    ticket(
      {
        id: 'tk-2086',
        reference: 'SUP-2086',
        subject: 'Question sur la facture de novembre',
        organization: 'Immo Rhône Gestion',
        requester: rhone,
        assignee: op(julie),
        priority: 'normale',
        status: 'ouvert',
        category: 'facturation',
        createdAt: '2026-11-11T15:30:00+01:00',
        participants: [rhone, julie],
        firstResponseLabel: '18 min',
        messages: [
          msg('m1', rhone.id, '2026-11-11T15:30:00+01:00', 'Pourquoi la facture de novembre est-elle supérieure à celle d’octobre ?'),
          msg('m2', julie.id, '2026-11-11T15:48:00+01:00', 'Bonjour, deux lots supplémentaires ont été activés le 02/11. Je vous envoie le détail.'),
        ],
      },
      viewer,
    ),
    ticket(
      {
        id: 'tk-2084',
        reference: 'SUP-2084',
        subject: 'Mise à jour du RIB de l’agence',
        organization: 'Cabinet Delmas Immobilier',
        requester: sophie,
        assignee: op(julie),
        priority: 'normale',
        status: 'en_attente',
        category: 'facturation',
        createdAt: '2026-11-10T10:00:00+01:00',
        participants: [sophie, julie],
        firstResponseLabel: '25 min',
        messages: [
          msg('m1', sophie.id, '2026-11-10T10:00:00+01:00', 'Nous changeons de banque : comment mettre à jour notre RIB ?'),
          msg('m2', julie.id, '2026-11-10T10:25:00+01:00', 'Merci d’envoyer le nouveau RIB signé en pièce jointe.'),
        ],
      },
      viewer,
    ),
    ticket(
      {
        id: 'tk-2079',
        reference: 'SUP-2079',
        subject: 'Import bancaire en erreur',
        organization: 'Résidences du Parc',
        requester: parc,
        assignee: op(theo),
        priority: 'basse',
        status: 'en_attente',
        category: 'documents',
        createdAt: '2026-11-09T09:00:00+01:00',
        participants: [parc, theo],
        firstResponseLabel: '1 h 05',
        messages: [
          msg('m1', parc.id, '2026-11-09T09:00:00+01:00', 'L’import du relevé bancaire échoue.'),
          msg('m2', theo.id, '2026-11-09T10:05:00+01:00', 'Pouvez-vous nous transmettre le fichier concerné ?'),
        ],
      },
      viewer,
    ),
    ...[
      ['tk-2070', 'SUP-2070', 'Changement de mot de passe', '2026-11-04T10:00:00+01:00', '2026-11-04T10:20:00+01:00'],
      ['tk-2065', 'SUP-2065', 'Quittance non générée', '2026-11-02T14:00:00+01:00', '2026-11-02T14:20:00+01:00'],
      ['tk-2060', 'SUP-2060', 'Invitation d’un collaborateur', '2026-10-30T09:30:00+01:00', '2026-10-30T09:50:00+01:00'],
    ].map(([id = '', reference = '', subject = '', at = '', replyAt = '']) =>
      ticket(
        {
          id,
          reference,
          subject,
          organization: 'Gestion Les Tilleuls',
          requester: marc,
          assignee: op(ines),
          priority: 'basse',
          status: 'resolu',
          category: 'compte',
          createdAt: at,
          participants: [marc, ines],
          firstResponseLabel: '20 min',
          messages: [
            msg('m1', marc.id, at, subject),
            msg('m2', ines.id, replyAt, 'C’est réglé, bonne journée.'),
          ],
        },
        viewer,
      ),
    ),
  ];
}

const runbook = (id: string, code: string, title: string, summary: string, steps: string) => ({
  id,
  question: `${code} · ${title}`,
  answer: `${summary} ${steps}`,
});

export function consoleSeed(): MessagerieSeed {
  return {
    me: ines,
    conversations: [],
    recipients: [],
    audiences: [],
    campaigns: [],
    tickets: tickets(),
    staff: staff.map(op),
    help: {
      categories: [
        {
          id: 'incident',
          title: 'Pendant un incident',
          articles: [
            runbook('run-01', 'RUN-01', 'File d’envoi saturée', 'Messagerie dégradée, limitation du débit, workers.', 'Vérifier la file, augmenter les workers, communiquer sur la page d’incident.'),
            runbook('run-02', 'RUN-02', 'Base de données lente', 'Requêtes lentes, connexions saturées, réplica.', 'Identifier les requêtes lentes, libérer les connexions, basculer sur le réplica si besoin.'),
            runbook('run-03', 'RUN-03', 'Restaurer une sauvegarde', 'Double validation, cible isolée ou production.', 'Choisir la sauvegarde, restaurer d’abord sur une cible isolée, faire valider par un second opérateur.'),
          ],
        },
        {
          id: 'organisations',
          title: 'Organisations et abonnements',
          articles: [
            runbook('run-07', 'RUN-07', 'Test trimestriel de restauration', 'Environnement isolé, contrôle d’intégrité.', 'Restaurer la dernière sauvegarde puis comparer les empreintes.'),
            runbook('run-08', 'RUN-08', 'Suspendre une organisation', 'Accès bloqué, données conservées.', 'Suspendre depuis la fiche de l’organisation et consigner le motif.'),
            runbook('run-09', 'RUN-09', 'Changer le plan d’une organisation', 'Prochaine échéance, modules concernés.', 'Choisir le nouveau plan, vérifier les modules activés et la date d’effet.'),
          ],
        },
        {
          id: 'conformite',
          title: 'Conformité et support',
          articles: [
            runbook('run-04', 'RUN-04', 'Demande RGPD d’effacement', 'Périmètre, pièces conservées, réponse.', 'Vérifier l’identité, délimiter le périmètre, conserver les pièces comptables et répondre sous un mois.'),
            runbook('run-05', 'RUN-05', 'Ouvrir un accès justifié', 'Motif, durée de 60 minutes, consignation.', 'Ouvrir l’accès depuis le ticket avec un motif obligatoire ; il est consigné dans le journal d’audit.'),
            runbook('run-06', 'RUN-06', 'Réinitialiser la 2FA d’un compte', 'Vérification d’identité, révocation des sessions.', 'Vérifier l’identité par un second canal puis révoquer les sessions actives.'),
          ],
        },
      ],
      contactTitle: 'Astreinte',
      contact: [
        { label: 'Technique', value: 'Théo Marchand · +33 6 •• •• •• 33' },
        { label: 'Exploitation', value: 'Lucas Bernard · +33 6 •• •• •• 12' },
        { label: 'Données personnelles', value: 'Karim Haddad, DPO' },
      ],
      emergencyTitle: null,
      emergency: [],
    },
    inbox: { staleCount: 0, staleDetail: null, averageReplyLabel: '2 h 10' },
    ticketBaseline: { firstResponse: '2 h 10', firstResponseDetail: 'Moyenne sur 30 jours', resolved30d: 38, satisfaction: 'Satisfaction : 94 %' },
    support: standardSupport,
  };
}
