export type ProfileKey = "agence" | "proprietaire" | "locataire";

export interface Profile {
  key: ProfileKey;
  label: string;
  path: string;
  title: string;
  text: string;
  points: readonly string[];
  details: readonly { title: string; text: string }[];
}

export const PROFILES: readonly Profile[] = [
  {
    key: "agence",
    label: "Agence",
    path: "/agences",
    title: "Pour les agences sous mandat",
    text: "Pilotez baux, loyers, mandats, honoraires et reversements depuis un espace organisé par rôle.",
    points: [
      "Registre des mandats et fonds des mandants",
      "Quittances, relances et rapprochement bancaire",
      "Équipe, droits par rôle et journal d’activité",
    ],
    details: [
      { title: "Baux et parties", text: "Baux composés, renouvellements et pièces à échéance suivis au même endroit." },
      { title: "Mandats et fonds des mandants", text: "Registre des mandats, honoraires de gestion et reversements, sur un compte distinct par mandant." },
      { title: "Loyers et quittances", text: "Échéancier, avis d’échéance, quittances, relances et indexation." },
      { title: "Rapprochement bancaire", text: "Import de relevés (camt et CSV), suggestions de rapprochement et contrôle avant validation." },
      { title: "Équipe et droits", text: "Chaque membre agit selon son rôle ; les actions sensibles sont tracées dans le journal d’activité." },
      { title: "Reprise de votre portefeuille", text: "Import de fiches et de relevés, avec contrôle avant validation." },
    ],
  },
  {
    key: "proprietaire",
    label: "Propriétaire",
    path: "/proprietaires",
    title: "Pour les propriétaires",
    text: "Suivez vos biens confiés ou gérez-les vous-même, avec relevés et documents fiscaux.",
    points: ["Relevés de gestion et reversements", "Documents et comptes rendus de l’agence", "Fiscalité des revenus fonciers"],
    details: [
      { title: "Biens confiés à une agence", text: "Consultez vos relevés de gestion, vos reversements et les comptes rendus de l’agence." },
      { title: "Gestion en autonomie", text: "Gérez vos lots, vos baux, vos quittances et vos charges sans passer par une agence." },
      { title: "Documents", text: "Retrouvez quittances, factures et pièces du bail dans un espace unique." },
      { title: "Fiscalité", text: "Suivez vos revenus fonciers et retrouvez les éléments utiles à votre déclaration." },
    ],
  },
  {
    key: "locataire",
    label: "Locataire",
    path: "/locataires",
    title: "Pour les locataires",
    text: "Payez, déclarez un incident, récupérez vos quittances et échangez avec l’agence.",
    points: [
      "Paiement du loyer en ligne, dès l’activation du prestataire de paiement",
      "Quittances et avis d’échéance",
      "Demandes et messagerie avec l’agence",
    ],
    details: [
      { title: "Loyers et quittances", text: "Consultez vos échéances, vos avis d’échéance et téléchargez vos quittances." },
      { title: "Demandes et interventions", text: "Signalez un incident et suivez son traitement." },
      { title: "Messagerie", text: "Échangez avec votre agence ou votre bailleur depuis votre espace." },
      { title: "Documents du bail", text: "Bail, états des lieux et justificatifs restent accessibles à tout moment." },
    ],
  },
];

export function profileByKey(key: ProfileKey): Profile {
  const found = PROFILES.find((profile) => profile.key === key);
  if (!found) throw new Error(`Profil inconnu : ${key}.`);
  return found;
}
