export interface Feature {
  title: string;
  text: string;
}

export const FEATURES: readonly Feature[] = [
  { title: "Baux et parties", text: "Baux composés, renouvellements, pièces à échéance." },
  { title: "Loyers et quittances", text: "Échéancier, avis, quittances, indexation." },
  { title: "Mandats et fonds", text: "Registre continu, honoraires, reversements." },
  { title: "Charges et régularisation", text: "Dépenses, exercices, relevés par locataire." },
  { title: "Rapprochement bancaire", text: "Import camt et CSV, suggestions, contrôle." },
  { title: "Messagerie et support", text: "Conversations par espace, accès support consenti." },
];
