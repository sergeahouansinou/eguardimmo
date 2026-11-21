import type { HelpCenterData } from "@eguardimmo/messagerie";

export const HELP_UPDATED_AT = "2026-11-21";

export const bailleurHelpCenter: HelpCenterData = {
  categories: [
    {
      id: "loyers",
      title: "Loyers et impayés",
      articles: [
        {
          id: "loyers-suivi",
          question: "Où suivre mes loyers ?",
          answer: "Dans Loyers, vous retrouvez les échéances, les paiements enregistrés et les quittances. Un paiement reçu se saisit depuis Encaisser un loyer.",
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
      id: "prets",
      title: "Prêts et coût de revient",
      articles: [
        {
          id: "prets-suivi",
          question: "Comment suivre un prêt immobilier ?",
          answer: "Dans Prêts, ajoutez le prêt avec son capital, son taux, sa durée, son différé et son assurance : le tableau d’amortissement est calculé par le serveur, ou remplacé par celui de votre banque. Le capital restant dû est une donnée contractuelle, jamais un solde comptable : un prêt n’écrit rien dans votre comptabilité.",
          href: "/finances/prets",
          hrefLabel: "Ouvrir Prêts",
        },
        {
          id: "cout-de-revient",
          question: "À quoi sert le coût de revient d’un bien ?",
          answer: "Il rassemble le prix d’achat, les frais d’acquisition, les frais d’agence et les travaux initiaux. Il sert de base au calcul de la rentabilité par bien.",
          href: "/finances/cout-de-revient",
          hrefLabel: "Ouvrir Coût de revient",
        },
      ],
    },
    {
      id: "fiscalite",
      title: "Fiscalité",
      articles: [
        {
          id: "revenus-fonciers",
          question: "Comment obtenir mes montants de revenus fonciers ?",
          answer: "Dans Fiscalité, le calcul d’une année présente les lignes de la déclaration 2044 et les deux bases (micro-foncier et régime réel), sans recommander de régime. Seule l’année de revenus 2025 est prise en charge pour le moment. Ces montants sont à faire valider par un expert-comptable : l’application ne dépose rien auprès de l’administration.",
          href: "/finances/fiscalite",
          hrefLabel: "Ouvrir Fiscalité",
        },
        {
          id: "synthese-figee",
          question: "Que signifie figer une synthèse ?",
          answer: "Figer enregistre les montants calculés à un instant donné, avec le PDF. Pour les corriger ensuite, il faut créer une rectification : l’ancienne synthèse est conservée comme remplacée.",
          href: "/finances/fiscalite",
          hrefLabel: "Ouvrir Fiscalité",
        },
      ],
    },
    {
      id: "analytique",
      title: "Analytique",
      articles: [
        {
          id: "analytique-contenu",
          question: "Que montre l’analytique ?",
          answer: "Les revenus et dépenses d’après votre grand livre, l’occupation de vos lots, la rentabilité par bien et un prévisionnel de trésorerie sur 12 mois. Le prévisionnel est une projection fondée sur vos hypothèses, pas un solde bancaire.",
          href: "/analytique",
          hrefLabel: "Ouvrir Analytique",
        },
      ],
    },
    {
      id: "compte",
      title: "Équipe et sécurité",
      articles: [
        {
          id: "double-authentification",
          question: "Pourquoi me demande-t-on un code de double authentification ?",
          answer: "Certaines actions sensibles, comme le téléchargement d’un PDF fiscal d’une agence ou un reversement, demandent de confirmer votre identité avec un code de moins de 10 minutes.",
          href: "/compte/securite",
          hrefLabel: "Ouvrir la sécurité du compte",
        },
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

export const mandantHelpCenter: HelpCenterData = {
  categories: [
    {
      id: "espace",
      title: "Mon espace",
      articles: [
        {
          id: "consulter",
          question: "Que puis-je consulter dans mon espace ?",
          answer: "Vos biens, vos baux, vos loyers et reversements, les comptes rendus de gestion publiés par votre agence, vos documents, vos interventions et, selon votre rôle, les décisions à prendre.",
          href: "/biens",
          hrefLabel: "Ouvrir Mes biens",
        },
        {
          id: "lecture-seule",
          question: "Pourquoi certaines actions sont-elles indisponibles ?",
          answer: "Selon votre rôle sur le mandat ou si votre accès est en lecture seule, vous pouvez consulter sans pouvoir agir. Votre agence peut modifier ces droits.",
        },
      ],
    },
    {
      id: "comptes-rendus",
      title: "Comptes rendus et loyers",
      articles: [
        {
          id: "comptes-rendus",
          question: "Où trouver mes comptes rendus de gestion ?",
          answer: "Dans Comptes rendus : chaque compte rendu publié se consulte et se télécharge en PDF. Un compte rendu marqué « Remplacé » a été republié : ouvrez la version la plus récente.",
          href: "/comptes-rendus",
          hrefLabel: "Ouvrir Comptes rendus",
        },
        {
          id: "reversements",
          question: "Où voir mes loyers et mes reversements ?",
          answer: "Dans Loyers, mois par mois, d’après les encaissements enregistrés par l’agence.",
          href: "/loyers",
          hrefLabel: "Ouvrir Loyers",
        },
      ],
    },
    {
      id: "fiscalite",
      title: "Fiscalité",
      articles: [
        {
          id: "releves-fiscaux",
          question: "Où trouver mes relevés fiscaux ?",
          answer: "Dans Fiscalité, vos relevés de revenus fonciers publiés par l’agence, avec leur PDF. Ils vous aident à préparer votre déclaration, que vous faites vous-même : l’application ne dépose rien. Faites valider ces montants par un expert-comptable.",
          href: "/fiscalite",
          hrefLabel: "Ouvrir Fiscalité",
        },
      ],
    },
    {
      id: "interventions",
      title: "Interventions et devis",
      articles: [
        {
          id: "devis-accord",
          question: "Pourquoi mon accord est-il demandé pour un devis ?",
          answer: "Quand une intervention nécessite votre décision, l’agence vous transmet le devis : vous l’acceptez ou le refusez depuis la page de l’intervention.",
          href: "/interventions",
          hrefLabel: "Ouvrir Interventions",
        },
      ],
    },
    {
      id: "contact",
      title: "Contact",
      articles: [
        {
          id: "ecrire-agence",
          question: "Comment écrire à mon agence ?",
          answer: "Utilisez « Écrire à l’agence » : la conversation se poursuit dans Messages.",
          href: "/messages",
          hrefLabel: "Ouvrir Messages",
        },
        {
          id: "support-contact",
          question: "Comment joindre le support eGuardImmo ?",
          answer: "Pour un problème avec l’application elle-même, utilisez « Écrire au support » : votre demande est suivie dans Support.",
          href: "/support",
          hrefLabel: "Ouvrir Support",
        },
      ],
    },
  ],
  contactTitle: "Contacter votre agence",
  contact: [],
  emergencyTitle: null,
  emergency: [],
};
