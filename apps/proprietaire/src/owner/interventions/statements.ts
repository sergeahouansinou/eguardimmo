import type { ApprovalDecision } from "./model";

export const OWNER_DECISION_STATEMENTS: Readonly<Record<string, string>> = {
  v1: "Je décide sur ce devis tel qu’il est affiché sur cette page. Ma décision est enregistrée avec la date et l’heure, la version du devis que je vois et ma confirmation par double authentification, puis communiquée à l’agence.",
};

export function statementOf(version: string | null): string | null {
  if (version === null) return null;
  return OWNER_DECISION_STATEMENTS[version] ?? null;
}

export interface DecisionCopy {
  open: string;
  title: string;
  confirm: string;
  commentLabel: string;
  commentPlaceholder: string;
  commentRequired: boolean;
  done: string;
  variant: "primary" | "secondary";
}

export const DECISION_COPY: Readonly<Record<ApprovalDecision, DecisionCopy>> = {
  accept: {
    open: "Accepter le devis",
    title: "Accepter ce devis ?",
    confirm: "Accepter le devis",
    commentLabel: "Commentaire (facultatif)",
    commentPlaceholder: "Ex. : D’accord, merci de prévenir le locataire avant le passage.",
    commentRequired: false,
    done: "Devis accepté. Votre décision est enregistrée et l’agence en est informée.",
    variant: "primary",
  },
  refuse: {
    open: "Refuser le devis",
    title: "Refuser ce devis ?",
    confirm: "Refuser le devis",
    commentLabel: "Motif du refus",
    commentPlaceholder: "Ex. : Le montant est trop élevé, merci de demander un second devis.",
    commentRequired: true,
    done: "Devis refusé. Votre décision est enregistrée et l’agence en est informée.",
    variant: "secondary",
  },
  question: {
    open: "Demander une précision",
    title: "Demander une précision sur ce devis ?",
    confirm: "Envoyer ma question",
    commentLabel: "Votre question",
    commentPlaceholder: "Ex. : Pouvez-vous détailler les fournitures prévues ?",
    commentRequired: true,
    done: "Votre question est enregistrée et transmise à l’agence. La demande reste ouverte.",
    variant: "secondary",
  },
};

export const REPLAYED_MESSAGE = "Cette décision était déjà enregistrée : rien n’a été modifié.";
export const COMMENT_MIN = 5;
export const COMMENT_MAX = 500;
