import type { GatedFamily } from "./capabilities";

export interface UnavailableLink {
  href: string;
  label: string;
}

export interface UnavailableCopy {
  alertTitle: string;
  description: string;
  links: readonly UnavailableLink[];
}

const PAY_LINKS: readonly UnavailableLink[] = [
  { href: "/loyers/payer", label: "Payer mon loyer" },
  { href: "/loyers/paiements", label: "Mes paiements" },
];

export const familyCopy: Partial<Record<GatedFamily, UnavailableCopy>> = {
  prelevement: {
    alertTitle: "Bientôt disponible",
    description:
      "Le prélèvement automatique du loyer n’est pas encore relié au serveur : le mandat SEPA se signe chez le prestataire de paiement et ne peut pas encore être créé, consulté ni révoqué depuis votre espace. Aucune donnée d’exemple n’est affichée à la place.",
    links: PAY_LINKS,
  },
  simulation: {
    alertTitle: "Réservée à la démonstration",
    description:
      "Cette page de paiement simulée n’existe qu’en démonstration. Avec le serveur, vous réglez sur la page sécurisée du prestataire de paiement, ouverte depuis « Payer mon loyer » ; le suivi se trouve dans « Mes paiements ».",
    links: PAY_LINKS,
  },
};
