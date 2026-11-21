import type { BadgeTone } from "@eguardimmo/ui";
import type { TaxStatementStatus } from "./model";

export const STATEMENT_STATUS: Record<TaxStatementStatus, { label: string; tone: BadgeTone }> = {
  published: { label: "Publié", tone: "success" },
  superseded: { label: "Remplacé", tone: "neutral" },
};

export const VALIDATION_NOTE = "Ces montants sont à faire valider par un expert-comptable ou un conseil fiscal avant toute déclaration : votre agence ne dépose rien auprès de l’administration à votre place.";
