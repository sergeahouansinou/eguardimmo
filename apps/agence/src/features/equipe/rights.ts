export const ROLE_IDS = ["titulaire", "administrateur", "gestionnaire", "comptable"] as const;
export type RoleId = (typeof ROLE_IDS)[number];

export const INVITABLE_ROLE_IDS = ["administrateur", "gestionnaire", "comptable"] as const;
export type InvitableRoleId = (typeof INVITABLE_ROLE_IDS)[number];

export const ROLE_LABELS: Readonly<Record<RoleId, string>> = {
  titulaire: "Titulaire",
  administrateur: "Administrateur",
  gestionnaire: "Gestionnaire",
  comptable: "Comptable",
};

export const ROLE_SUMMARIES: Readonly<Record<InvitableRoleId, string>> = {
  administrateur: "Mêmes droits que le titulaire, clôture des reversements comprise",
  gestionnaire: "Mandats, biens, baux, loyers, interventions et préparation des reversements",
  comptable: "Finances, banque, reversements et comptes rendus ; le reste en lecture",
};

export const TWO_FACTOR_ROLE_IDS: readonly RoleId[] = ["titulaire", "administrateur"];

export type RightLevel = "none" | "read" | "prepare" | "write" | "write_two_factor";

export const LEVEL_LABELS: Readonly<Record<RightLevel, string>> = {
  none: "Aucun",
  read: "Lecture",
  prepare: "Préparation",
  write: "Modifier",
  write_two_factor: "Modifier, 2FA",
};

export type RightId =
  | "mandats"
  | "parties"
  | "anonymisation"
  | "comptes-parties"
  | "biens"
  | "baux"
  | "baux-annexes"
  | "etats-des-lieux"
  | "loyers"
  | "encaissement"
  | "avis-quittances"
  | "remboursement-locataire"
  | "impayes"
  | "factures"
  | "avoirs"
  | "reversements-preparation"
  | "reversements-execution"
  | "depenses"
  | "fonds-de-tiers"
  | "decomptes"
  | "banque"
  | "comptes-suivis"
  | "grand-livre"
  | "periodes"
  | "interventions"
  | "factures-prestataires"
  | "imputations"
  | "reglements-prestataires"
  | "comptes-rendus-preparation"
  | "comptes-rendus-publication"
  | "comptes-rendus-export"
  | "messages"
  | "support"
  | "documents-lecture"
  | "documents-depot"
  | "conformite"
  | "paiements"
  | "compte-psp"
  | "equipe";

export interface RightRow {
  id: RightId;
  label: string;
  remark?: string;
  levels: Readonly<Record<RoleId, RightLevel>>;
}

type Levels = readonly [RightLevel, RightLevel, RightLevel, RightLevel];

function row(id: RightId, label: string, [titulaire, administrateur, gestionnaire, comptable]: Levels, remark?: string): RightRow {
  return { id, label, levels: { titulaire, administrateur, gestionnaire, comptable }, ...(remark === undefined ? {} : { remark }) };
}

const ALL_WRITE: Levels = ["write", "write", "write", "write"];
const STAFF_WRITE: Levels = ["write", "write", "write", "none"];
const STAFF_WRITE_ACCOUNTANT_READ: Levels = ["write", "write", "write", "read"];
const ADMIN_WRITE_ACCOUNTANT: Levels = ["write_two_factor", "write_two_factor", "none", "write_two_factor"];
const ADMIN_ONLY_TWO_FACTOR: Levels = ["write_two_factor", "write_two_factor", "none", "none"];
const NOT_MANAGER_WRITE: Levels = ["write", "write", "none", "write"];

export const RIGHTS: readonly RightRow[] = [
  row("mandats", "Mandats, mandants et barème", STAFF_WRITE_ACCOUNTANT_READ, "Le comptable ne voit pas la note de mandat."),
  row("parties", "Fiches des parties", STAFF_WRITE_ACCOUNTANT_READ),
  row("anonymisation", "Anonymisation d'une partie", ["write", "write", "none", "none"]),
  row("comptes-parties", "Comptes bancaires des parties et accès mandant", ["write_two_factor", "write_two_factor", "write_two_factor", "none"], "Preuve de connexion récente exigée."),
  row("biens", "Biens et lots", STAFF_WRITE_ACCOUNTANT_READ),
  row("baux", "Baux", STAFF_WRITE_ACCOUNTANT_READ, "Le comptable ne voit ni la note ni les garanties."),
  row("baux-annexes", "Congés, assurance, pièces partagées d'un bail", STAFF_WRITE),
  row("etats-des-lieux", "États des lieux", STAFF_WRITE),
  row("loyers", "Loyers et appels", STAFF_WRITE_ACCOUNTANT_READ),
  row("encaissement", "Saisie d'un encaissement", ALL_WRITE),
  row("avis-quittances", "Avis d'échéance, annulations, quittances", STAFF_WRITE),
  row("remboursement-locataire", "Remboursement à un locataire", ["write_two_factor", "write_two_factor", "none", "write_two_factor"]),
  row("impayes", "Impayés et recouvrement", STAFF_WRITE_ACCOUNTANT_READ),
  row("factures", "Factures", ALL_WRITE),
  row("avoirs", "Avoirs", NOT_MANAGER_WRITE),
  row("reversements-preparation", "Honoraires et reversements : lecture et préparation", ["prepare", "prepare", "prepare", "prepare"]),
  row("reversements-execution", "Reversements : validation, exécution, apports, clôture, export", ADMIN_WRITE_ACCOUNTANT),
  row("depenses", "Dépenses et charges", ALL_WRITE),
  row("fonds-de-tiers", "Dépenses sur fonds de tiers", ADMIN_WRITE_ACCOUNTANT, "Preuve de connexion récente exigée."),
  row("decomptes", "Émission des décomptes de charges", STAFF_WRITE),
  row("banque", "Banque et rapprochement", ADMIN_WRITE_ACCOUNTANT),
  row("comptes-suivis", "Comptes suivis", ADMIN_ONLY_TWO_FACTOR, "Preuve de connexion récente exigée."),
  row("grand-livre", "Grand livre", ["read", "read", "none", "read"]),
  row("periodes", "Périodes comptables", ["read", "read", "read", "read"]),
  row("interventions", "Interventions et devis", STAFF_WRITE_ACCOUNTANT_READ),
  row("factures-prestataires", "Factures de prestataires", ALL_WRITE),
  row("imputations", "Imputations de factures de prestataires", NOT_MANAGER_WRITE),
  row("reglements-prestataires", "Règlements de prestataires", ADMIN_WRITE_ACCOUNTANT),
  row("comptes-rendus-preparation", "Comptes rendus : préparation", ALL_WRITE),
  row("comptes-rendus-publication", "Comptes rendus : publication", STAFF_WRITE),
  row("comptes-rendus-export", "Comptes rendus : export des lignes", ADMIN_WRITE_ACCOUNTANT),
  row("messages", "Messages aux locataires et mandants, diffusions", STAFF_WRITE, "Envoi d'une diffusion : 2FA et preuve récente. Le comptable n'a que la messagerie interne."),
  row("support", "Accès du support", ADMIN_ONLY_TWO_FACTOR, "Preuve de connexion récente exigée."),
  row("documents-lecture", "Documents : téléchargement", ["read", "read", "read", "read"]),
  row("documents-depot", "Documents : dépôt, pièces à échéance", STAFF_WRITE),
  row("conformite", "Conformité", STAFF_WRITE_ACCOUNTANT_READ),
  row("paiements", "Paiements en ligne", ["read", "read", "read", "read"]),
  row("compte-psp", "Compte de paiement en ligne", ADMIN_ONLY_TWO_FACTOR, "Preuve de connexion récente exigée."),
  row("equipe", "Équipe, identité légale, sécurité, référentiels", ["write", "write", "read", "read"]),
];

export const ROLE_PANEL_RIGHT_IDS: readonly RightId[] = ["mandats", "loyers", "reversements-preparation", "reversements-execution", "banque", "equipe"];

export function rightsOfRole(role: RoleId, only?: readonly RightId[]): readonly { id: RightId; label: string; level: RightLevel }[] {
  return RIGHTS.filter((right) => only === undefined || only.includes(right.id)).map((right) => ({
    id: right.id,
    label: right.label,
    level: right.levels[role],
  }));
}
