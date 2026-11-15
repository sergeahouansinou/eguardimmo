import { AGENCY, CURRENT_USER, MANDANTS } from "@/features/shared/directory";
import { DEMO_TODAY, formatDate } from "@/features/shared/dates";
import type { ConformiteData, Piece } from "./schemas";

const holder = { label: "Titulaire", value: AGENCY.name };
const representative = { label: "Représentant", value: CURRENT_USER.name };

const cartePro: Piece = {
  id: "carte-professionnelle",
  title: "Carte professionnelle",
  fullTitle: "Carte professionnelle",
  subtitle: "Transactions et gestion immobilière",
  reference: "CPI 7501 2025 000 048 117",
  expiresOn: "2028-06-30",
  validLabel: "Valide",
  renewable: true,
  renewalSubject: "La carte professionnelle",
  renewalAction: "Renouveler la carte professionnelle",
  renewalImpact: null,
  upkeepNote: null,
  fileName: "carte-professionnelle-cpi-7501.pdf",
  details: [
    holder,
    representative,
    { label: "Numéro", value: "", field: "reference" },
    { label: "Mention", value: "Transactions et gestion immobilière" },
    { label: "Délivrée le", value: "01/07/2025" },
    { label: "Échéance", value: "", field: "expiresOn" },
  ],
  conditions: [
    { id: "garantie", title: "Garantie financière en cours de validité", detail: null, pieceId: "garantie-financiere", manual: null },
    { id: "rcp", title: "Assurance RCP en cours de validité", detail: null, pieceId: "assurance-rcp", manual: null },
    { id: "formation", title: "Formation continue, 42 heures sur 3 ans", detail: "42 h sur 42 réalisées", pieceId: "formation-continue", manual: null },
    {
      id: "aptitude",
      title: "Aptitude professionnelle du titulaire",
      detail: "Diplôme enregistré le 14/06/2025",
      pieceId: null,
      manual: { label: "Valide", tone: "success" },
    },
    {
      id: "casier",
      title: "Extrait de casier judiciaire",
      detail: "À demander avant le dépôt du dossier",
      pieceId: null,
      manual: { label: "À fournir", tone: "neutral" },
    },
  ],
  history: [
    { id: "h1", title: "Carte délivrée", detail: "01/07/2025 · CCI Paris Île-de-France", date: "2025-07-01", tone: "success" },
    { id: "h2", title: "Dossier déposé", detail: "12/06/2025 · pièces vérifiées par la CCI", date: "2025-06-12", tone: "default" },
  ],
  reminder: null,
};

const garantie: Piece = {
  id: "garantie-financiere",
  title: "Garantie financière",
  fullTitle: "Garantie financière",
  subtitle: "Montant garanti : 120 000 €",
  reference: "GF-2025-3317",
  expiresOn: "2027-12-31",
  validLabel: "Valide",
  renewable: true,
  renewalSubject: "La garantie financière",
  renewalAction: "Renouveler la garantie financière",
  renewalImpact: "Sans garantie financière, l’agence ne peut plus détenir de fonds pour le compte des mandants.",
  upkeepNote: null,
  fileName: "garantie-financiere-2026.pdf",
  details: [
    holder,
    { label: "Garant", value: "Caisse mutuelle de garantie" },
    { label: "Montant garanti", value: "120 000 €" },
    { label: "Référence", value: "", field: "reference" },
    { label: "Échéance", value: "", field: "expiresOn" },
  ],
  conditions: [
    { id: "montant", title: "Montant garanti couvrant les fonds détenus", detail: "120 000 € garantis", pieceId: null, manual: { label: "Suffisant", tone: "success" } },
    { id: "attestation", title: "Attestation du garant à jour", detail: "Reçue le 05/01/2026", pieceId: null, manual: { label: "Valide", tone: "success" } },
  ],
  history: [
    { id: "h1", title: "Attestation reçue", detail: "05/01/2026 · Caisse mutuelle de garantie", date: "2026-01-05", tone: "success" },
    { id: "h2", title: "Garantie souscrite", detail: "20/12/2025 · 120 000 € garantis", date: "2025-12-20", tone: "default" },
  ],
  reminder: null,
};

const rcp: Piece = {
  id: "assurance-rcp",
  title: "Assurance RCP",
  fullTitle: "Assurance responsabilité civile professionnelle",
  subtitle: "Mercier Assurances Pro",
  reference: "RCP-2026-88412",
  expiresOn: "2026-12-31",
  validLabel: "Valide",
  renewable: true,
  renewalSubject: "L’assurance RCP",
  renewalAction: "Renouveler l’assurance RCP",
  renewalImpact: "Le renouvellement conditionne la carte professionnelle.",
  upkeepNote: null,
  fileName: "attestation-rcp-2026.pdf",
  details: [
    holder,
    { label: "Assureur", value: "Mercier Assurances Pro" },
    { label: "Numéro de police", value: "", field: "reference" },
    { label: "Échéance", value: "", field: "expiresOn" },
  ],
  conditions: [
    { id: "attestation", title: "Attestation d’assurance à jour", detail: "Reçue le 02/01/2026", pieceId: null, manual: { label: "Valide", tone: "success" } },
    { id: "couverture", title: "Couverture conforme à la réglementation", detail: "Activités de transaction et de gestion", pieceId: null, manual: { label: "Conforme", tone: "success" } },
  ],
  history: [
    { id: "h1", title: "Attestation reçue", detail: "02/01/2026 · Mercier Assurances Pro", date: "2026-01-02", tone: "success" },
    { id: "h2", title: "Contrat souscrit", detail: "18/12/2025 · Mercier Assurances Pro", date: "2025-12-18", tone: "default" },
  ],
  reminder: null,
};

const registre: Piece = {
  id: "registre-des-mandats",
  title: "Registre des mandats",
  fullTitle: "Registre des mandats",
  subtitle: `Tenu à jour au ${formatDate(DEMO_TODAY)}`,
  reference: `${String(MANDANTS.length)} mandats inscrits`,
  expiresOn: "2027-01-31",
  validLabel: "Conforme",
  renewable: false,
  renewalSubject: "Le registre des mandats",
  renewalAction: "Mettre à jour le registre",
  renewalImpact: null,
  upkeepNote: "Le registre est complété à chaque signature de mandat. Une vérification annuelle est à faire avant l’échéance.",
  fileName: "registre-des-mandats-2026.pdf",
  details: [
    holder,
    { label: "Tenu par", value: CURRENT_USER.name },
    { label: "Inscriptions", value: "", field: "reference" },
    { label: "Vérification avant le", value: "", field: "expiresOn" },
  ],
  conditions: [
    { id: "numerotation", title: "Numérotation continue des mandats", detail: "Sans numéro manquant", pieceId: null, manual: { label: "Conforme", tone: "success" } },
    { id: "ordre", title: "Inscription dans l’ordre chronologique", detail: "Dernière inscription le 04/11/2026", pieceId: null, manual: { label: "Conforme", tone: "success" } },
  ],
  history: [{ id: "h1", title: "Registre vérifié", detail: "31/01/2026 · sans anomalie", date: "2026-01-31", tone: "success" }],
  reminder: null,
};

const formation: Piece = {
  id: "formation-continue",
  title: "Formation continue",
  fullTitle: "Formation continue",
  subtitle: `${CURRENT_USER.name}, 2024 à 2026`,
  reference: "42 h sur 42",
  expiresOn: "2026-12-31",
  validLabel: "Validée",
  renewable: false,
  renewalSubject: "La formation continue",
  renewalAction: "Déclarer des heures",
  renewalImpact: null,
  upkeepNote: "Le titulaire doit justifier de 42 heures de formation sur 3 ans pour renouveler la carte professionnelle.",
  fileName: "attestations-formation-2024-2026.pdf",
  details: [
    holder,
    representative,
    { label: "Heures réalisées", value: "", field: "reference" },
    { label: "Fin du cycle", value: "", field: "expiresOn" },
  ],
  conditions: [
    { id: "volume", title: "42 heures sur 3 ans", detail: "42 h sur 42 réalisées", pieceId: null, manual: { label: "Validée", tone: "success" } },
    { id: "justificatifs", title: "Attestations de formation déposées", detail: "Trois attestations annuelles", pieceId: null, manual: { label: "Valide", tone: "success" } },
  ],
  history: [
    { id: "h1", title: "Dernière formation validée", detail: "14/10/2026 · 14 h", date: "2026-10-14", tone: "success" },
    { id: "h2", title: "Cycle ouvert", detail: "01/01/2024 · 42 h à réaliser", date: "2024-01-01", tone: "default" },
  ],
  reminder: null,
};

export function initialConformite(): ConformiteData {
  return {
    pieces: [cartePro, garantie, rcp, registre, formation],
    reminders: { days: [90, 30, 7], recipients: ["sophie-delmas", "camille-perrin"], channels: ["email", "app"] },
  };
}
