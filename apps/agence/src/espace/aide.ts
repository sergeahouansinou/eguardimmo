import type { HelpCenterData } from "@eguardimmo/messagerie";

export const AGENCE_HELP_UPDATED_AT = "2026-11-21";

export const agenceHelpCenter: HelpCenterData = {
  categories: [
    {
      id: "loyers",
      title: "Loyers et impayés",
      articles: [
        {
          id: "loyers-suivi",
          question: "Où suivre les loyers attendus et encaissés ?",
          answer: "Dans Loyers, vous retrouvez les échéances, les paiements enregistrés et les quittances. Un paiement reçu se saisit depuis Encaissements.",
          href: "/finances/loyers",
          hrefLabel: "Ouvrir Loyers",
        },
        {
          id: "impayes-relance",
          question: "Que faire en cas de loyer impayé ?",
          answer: "Les loyers non réglés apparaissent dans Impayés. Ouvrez le dossier pour relancer le locataire et suivre le recouvrement.",
          href: "/finances/impayes",
          hrefLabel: "Ouvrir Impayés",
        },
      ],
    },
    {
      id: "reversements",
      title: "Reversements et honoraires",
      articles: [
        {
          id: "reversements-lot",
          question: "Comment préparer un reversement ?",
          answer: "Dans Reversements, ouvrez un mandant ou composez un lot de virements. Les opérations sensibles demandent de confirmer votre identité avec un code de double authentification de moins de 10 minutes.",
          href: "/finances/reversements",
          hrefLabel: "Ouvrir Reversements",
        },
        {
          id: "honoraires",
          question: "Où consulter les honoraires et leur barème ?",
          answer: "Dans Honoraires, vous suivez les honoraires de l’agence ; le barème se simule depuis la page dédiée.",
          href: "/finances/honoraires",
          hrefLabel: "Ouvrir Honoraires",
        },
      ],
    },
    {
      id: "fiscalite",
      title: "Fiscalité et analytique",
      articles: [
        {
          id: "releves-fiscaux",
          question: "Comment préparer les relevés fiscaux de mes mandants ?",
          answer: "Dans Fiscalité des mandants, choisissez l’année de revenus, sélectionnez les mandants puis générez les relevés : la génération se fait par lots de 10 mandants au plus. Un relevé publié devient visible dans l’espace du mandant. Les montants sont à faire valider par un expert-comptable.",
          href: "/finances/fiscalite",
          hrefLabel: "Ouvrir Fiscalité des mandants",
        },
        {
          id: "analytique",
          question: "Que montre l’analytique de l’agence ?",
          answer: "Revenus et dépenses d’après le grand livre, et occupation des lots d’après les baux. La rentabilité par bien et le prévisionnel concernent les bailleurs qui gèrent leur propre patrimoine.",
          href: "/analytique",
          hrefLabel: "Ouvrir Analytique",
        },
      ],
    },
    {
      id: "equipe",
      title: "Équipe et sécurité",
      articles: [
        {
          id: "equipe-inviter",
          question: "Comment inviter un collaborateur ?",
          answer: "Dans Équipe, invitez un collaborateur en indiquant son adresse e-mail et son rôle. Les droits de chaque rôle sont consultables dans Rôles et droits.",
          href: "/equipe",
          hrefLabel: "Ouvrir Équipe",
        },
        {
          id: "journal",
          question: "Où voir ce qui a été fait dans l’agence ?",
          answer: "Le Journal d’activité liste les actions de l’équipe. Il est réservé au titulaire et à l’administrateur.",
          href: "/journal",
          hrefLabel: "Ouvrir le journal",
        },
      ],
    },
    {
      id: "support",
      title: "Support eGuardImmo",
      articles: [
        {
          id: "support-contact",
          question: "Comment joindre le support ?",
          answer: "Utilisez « Écrire au support » : votre demande est suivie dans Support, où vous lisez les réponses de l’équipe.",
          href: "/support",
          hrefLabel: "Ouvrir Support",
        },
      ],
    },
  ],
  contactTitle: "Contacter le support eGuardImmo",
  contact: [],
  emergencyTitle: null,
  emergency: [],
};
