import type { LegalSection } from "@/components/LegalSections";

export const MENTIONS_LEGALES: readonly LegalSection[] = [
  {
    title: "Éditeur du site",
    fields: ["Dénomination sociale", "Forme juridique", "Capital social", "Adresse du siège", "Immatriculation (RCS ou équivalent)", "Numéro de TVA intracommunautaire", "Directeur de la publication", "Adresse e-mail de contact", "Téléphone"],
  },
  { title: "Hébergeur", fields: ["Dénomination de l’hébergeur", "Adresse de l’hébergeur", "Contact de l’hébergeur"] },
  { title: "Propriété intellectuelle", fields: ["Mentions relatives aux contenus, marques et logos"] },
  { title: "Médiation et litiges", fields: ["Mentions applicables"] },
];

export const CONFIDENTIALITE: readonly LegalSection[] = [
  { title: "Responsable du traitement", fields: ["Identité et coordonnées du responsable du traitement", "Délégué à la protection des données (le cas échéant)"] },
  {
    title: "Données collectées par le formulaire de contact",
    fields: ["Finalité du traitement", "Base légale", "Destinataires des données", "Durée de conservation", "Transferts hors de l’Union européenne"],
  },
  { title: "Vos droits", fields: ["Modalités d’exercice des droits d’accès, de rectification, d’effacement et d’opposition", "Autorité de contrôle compétente"] },
  { title: "Cookies et traceurs", fields: ["Traceurs utilisés par ce site et modalités de consentement"] },
];
