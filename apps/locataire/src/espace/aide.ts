import { locataireProfile } from "@eguardimmo/messagerie";
import type { HelpCenterData, MessagerieProfile } from "@eguardimmo/messagerie";

export const apiHelpCenter: HelpCenterData = {
  categories: [
    {
      id: "espace",
      title: "Mon espace locataire",
      articles: [
        {
          id: "acces",
          question: "Comment obtenir l’accès à mon bail ?",
          answer:
            "Votre agence ou votre bailleur vous envoie une invitation par e-mail. En l’acceptant avec votre compte, vos baux apparaissent dans « Mes baux ».",
          href: "/bail",
          hrefLabel: "Ouvrir mes baux",
        },
        {
          id: "bail-absent",
          question: "Pourquoi un de mes baux n’apparaît-il pas ?",
          answer:
            "Seuls les baux signés ou résiliés dont vous êtes locataire sont visibles. Les garants et les occupants n’ont pas d’espace pour le moment. Un bail terminé reste consultable pendant 12 mois.",
        },
        {
          id: "retrait",
          question: "Comment retirer mon accès à une organisation ?",
          answer:
            "Dans « Mes accès », choisissez Retirer à côté de l’organisation. Elle conserve vos baux et leurs pièces ; elle devra vous inviter de nouveau pour rétablir l’accès.",
          href: "/acces",
          hrefLabel: "Ouvrir mes accès",
        },
      ],
    },
    {
      id: "logement",
      title: "Loyers, documents et logement",
      articles: [
        {
          id: "quittances",
          question: "Où trouver mes quittances et mes paiements ?",
          answer:
            "Les avis d’échéance et le paiement en ligne sont dans « Mes loyers », les règlements dans « Mes paiements » et les quittances dans « Mes quittances ». Les décomptes de charges se trouvent dans « Régularisation des charges ».",
          href: "/loyers",
          hrefLabel: "Ouvrir mes loyers",
        },
        {
          id: "documents",
          question: "Où trouver les documents de mon bail ?",
          answer: "Les pièces de vos baux, vos quittances, vos états des lieux et vos attestations d’assurance sont réunis dans « Documents », avec un téléchargement pour chacun.",
          href: "/documents",
          hrefLabel: "Ouvrir mes documents",
        },
        {
          id: "intervention",
          question: "Comment déclarer un souci dans mon logement ?",
          answer: "Dans « Interventions », décrivez le souci et ajoutez des photos : vous suivez ensuite les visites et échangez avec l’équipe sur la même page.",
          href: "/interventions/nouvelle",
          hrefLabel: "Déclarer une intervention",
        },
        {
          id: "conge",
          question: "Comment donner congé ?",
          answer: "Choisissez le motif et la date de départ souhaitée : la durée du préavis s’affiche selon le motif. Votre agence accuse réception de la demande.",
          href: "/bail/conge",
          hrefLabel: "Donner congé",
        },
      ],
    },
    {
      id: "support",
      title: "Support eGuardImmo",
      articles: [
        {
          id: "contacter",
          question: "Comment joindre le support ?",
          answer:
            "Utilisez « Écrire au support » : votre demande est suivie dans l’onglet « Mes demandes » et vous y lisez les réponses de l’équipe.",
        },
      ],
    },
  ],
  contactTitle: "Contacter le support eGuardImmo",
  contact: [],
  emergencyTitle: null,
  emergency: [],
};

export const apiLocataireProfile: MessagerieProfile = {
  ...locataireProfile,
  help: {
    ...locataireProfile.help,
    subtitle: "Les réponses aux questions fréquentes et le contact du support eGuardImmo.",
    searchPlaceholder: "Ex. invitation, accès, bail",
    writeLabel: null,
  },
};
