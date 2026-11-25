export const PASSWORD_MIN_LENGTH = 6;
export const PASSWORD_PLACEHOLDER = `${String(PASSWORD_MIN_LENGTH)} caractères minimum`;

const STRENGTH_PATTERNS = {
  mixedCase: /(\p{Ll}+.*\p{Lu})|(\p{Lu}+.*\p{Ll})/u,
  digit: /\p{N}/u,
  symbol: /[\p{Z}\p{S}\p{P}]/u,
} as const;

export function passwordLength(value: string): number {
  return Array.from(value).length;
}

export type StrengthLevel = "vide" | "faible" | "moyen" | "bon" | "excellent";

export interface PasswordStrength {
  level: StrengthLevel;
  label: string;
  percent: number;
}

const STRENGTHS: Record<StrengthLevel, PasswordStrength> = {
  vide: { level: "vide", label: "Aucune saisie", percent: 0 },
  faible: { level: "faible", label: "Faible", percent: 25 },
  moyen: { level: "moyen", label: "Moyen", percent: 50 },
  bon: { level: "bon", label: "Bon", percent: 75 },
  excellent: { level: "excellent", label: "Excellent", percent: 100 },
};

export function passwordStrength(value: string): PasswordStrength {
  if (value === "") return STRENGTHS.vide;
  const length = passwordLength(value);
  const points = [
    length >= 12,
    length >= 16,
    STRENGTH_PATTERNS.mixedCase.test(value),
    STRENGTH_PATTERNS.digit.test(value),
    STRENGTH_PATTERNS.symbol.test(value),
  ].filter(Boolean).length;
  if (points <= 1) return STRENGTHS.faible;
  if (points <= 3) return STRENGTHS.moyen;
  return points >= 5 ? STRENGTHS.excellent : STRENGTHS.bon;
}
