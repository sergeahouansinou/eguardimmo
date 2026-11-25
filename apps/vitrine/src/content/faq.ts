export interface FaqEntry {
  question: string;
  answer: string;
}

export const FAQ: readonly FaqEntry[] = [
  {
    question: "Mes données sont-elles séparées de celles des autres agences ?",
    answer: "Oui. Chaque organisation est cloisonnée côté serveur : un utilisateur ne lit jamais les données d’une autre organisation.",
  },
  {
    question: "Qui détient les fonds des propriétaires ?",
    answer:
      "eGuardImmo ne détient jamais les fonds. Les encaissements sont destinés à transiter par un prestataire de paiement, vers le compte de l’organisation. Le paiement en ligne sera proposé à l’activation de ce prestataire.",
  },
  {
    question: "Comment sont traitées les données personnelles ?",
    answer:
      "Le produit est conçu autour de la minimisation des données, de durées de conservation, de l’export et de la suppression de compte, avec un journal d’activité. Les engagements détaillés figurent dans la politique de confidentialité.",
  },
  {
    question: "Puis-je importer mon portefeuille existant ?",
    answer: "Oui, par import de fiches et de relevés bancaires, avec contrôle avant validation.",
  },
  {
    question: "Un même compte peut-il servir plusieurs profils ?",
    answer: "Oui. Un utilisateur qui cumule plusieurs profils, par exemple propriétaire et locataire, passe de l’un à l’autre sans se reconnecter.",
  },
];
