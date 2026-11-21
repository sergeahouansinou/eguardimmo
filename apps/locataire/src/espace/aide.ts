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
      id: "bientot",
      title: "Bientôt disponible",
      articles: [
        {
          id: "quittances",
          question: "Où trouver mes quittances et mes paiements ?",
          answer:
            "Les quittances, les avis d’échéance, les paiements, les interventions et les documents seront ajoutés prochainement à votre espace.",
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
