export const ROLE_IDS = ["titulaire", "gestionnaire", "comptable", "assistante"] as const;
export type RoleId = (typeof ROLE_IDS)[number];

export const INVITABLE_ROLE_IDS = ["gestionnaire", "comptable", "assistante"] as const;
export type InvitableRoleId = (typeof INVITABLE_ROLE_IDS)[number];

export const ROLE_LABELS: Readonly<Record<RoleId, string>> = {
  titulaire: "Titulaire",
  gestionnaire: "Gestionnaire",
  comptable: "Comptable",
  assistante: "Assistante",
};

export const ROLE_SUMMARIES: Readonly<Record<InvitableRoleId, string>> = {
  gestionnaire: "Mandants, biens, locataires, baux et encaissements",
  comptable: "Finances, reversements et honoraires",
  assistante: "Messages, documents et interventions",
};

export type RightLevel = "edit" | "read" | "none";

export const LEVEL_LABELS: Readonly<Record<RightLevel, string>> = {
  edit: "Modifier",
  read: "Lecture",
  none: "Aucun",
};

export type RightId =
  | "mandants"
  | "biens"
  | "encaissements"
  | "reversements"
  | "comptes-rendus"
  | "messages"
  | "interventions"
  | "documents"
  | "conformite"
  | "equipe"
  | "abonnement";

interface RightRow {
  id: RightId;
  label: string;
  levels: Readonly<Record<RoleId, RightLevel>>;
}

function row(id: RightId, label: string, titulaire: RightLevel, gestionnaire: RightLevel, comptable: RightLevel, assistante: RightLevel): RightRow {
  return { id, label, levels: { titulaire, gestionnaire, comptable, assistante } };
}

export const RIGHTS: readonly RightRow[] = [
  row("mandants", "Mandants et mandats", "edit", "edit", "read", "read"),
  row("biens", "Biens, locataires et baux", "edit", "edit", "read", "read"),
  row("encaissements", "Encaissements et impayés", "edit", "edit", "edit", "read"),
  row("reversements", "Reversements et honoraires", "edit", "read", "edit", "none"),
  row("comptes-rendus", "Comptes rendus aux mandants", "edit", "edit", "edit", "read"),
  row("messages", "Messages et campagnes", "edit", "edit", "read", "edit"),
  row("interventions", "Interventions et devis", "edit", "edit", "read", "edit"),
  row("documents", "Documents", "edit", "edit", "read", "edit"),
  row("conformite", "Conformité", "edit", "read", "none", "none"),
  row("equipe", "Équipe et réglages", "edit", "none", "none", "none"),
  row("abonnement", "Abonnement et facturation", "edit", "none", "none", "none"),
];

export const ROLE_PANEL_RIGHT_IDS: readonly RightId[] = ["mandants", "biens", "encaissements", "reversements", "equipe"];

export function rightsOfRole(role: RoleId, only?: readonly RightId[]): readonly { id: RightId; label: string; level: RightLevel }[] {
  return RIGHTS.filter((right) => only === undefined || only.includes(right.id)).map((right) => ({
    id: right.id,
    label: right.label,
    level: right.levels[role],
  }));
}
