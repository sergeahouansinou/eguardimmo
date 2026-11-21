import { PROOF_MAX_BYTES, PROOF_TYPES } from "./labels";
import { normalizeIban } from "./requests";

export interface RequestDraft {
  iban: string;
  bic: string;
  holderName: string;
  proof: File | null;
}

export type DraftProblems = Partial<Record<"iban" | "bic" | "holderName" | "proof", string>>;

const IBAN_SHAPE = /^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/;
const BIC_SHAPE = /^[A-Za-z]{6}[A-Za-z0-9]{2}([A-Za-z0-9]{3})?$/;
export const HOLDER_MAX = 200;

export function validateDraft(draft: RequestDraft): DraftProblems {
  const problems: DraftProblems = {};
  if (!IBAN_SHAPE.test(normalizeIban(draft.iban))) problems.iban = "Saisissez un IBAN valide, sans autre caractère que des lettres et des chiffres.";
  const bic = draft.bic.trim();
  if (bic !== "" && !BIC_SHAPE.test(bic)) problems.bic = "Un BIC compte 8 ou 11 caractères.";
  const holder = draft.holderName.trim();
  if (holder === "") problems.holderName = "Indiquez le titulaire du compte.";
  else if (holder.length > HOLDER_MAX) problems.holderName = `Le titulaire ne peut pas dépasser ${String(HOLDER_MAX)} caractères.`;
  if (draft.proof === null) problems.proof = "Joignez un justificatif du compte (RIB).";
  else if (!PROOF_TYPES.includes(draft.proof.type)) problems.proof = "Le justificatif doit être un PDF, une image JPEG ou PNG.";
  else if (draft.proof.size > PROOF_MAX_BYTES) problems.proof = "Le justificatif ne peut pas dépasser 5 Mo.";
  else if (draft.proof.size === 0) problems.proof = "Ce fichier est vide.";
  return problems;
}

export const CODE_SHAPE = /^\d{6}$/;
