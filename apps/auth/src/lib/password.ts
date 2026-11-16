export const PASSWORD_MIN_LENGTH = 12;

export const PASSWORD_PATTERNS = {
  mixedCase: /(\p{Ll}+.*\p{Lu})|(\p{Lu}+.*\p{Ll})/u,
  digit: /\p{N}/u,
  symbol: /[\p{Z}\p{S}\p{P}]/u,
} as const;

export interface PasswordCheck {
  id: "length" | "case" | "digit" | "symbol";
  label: string;
  ok: boolean;
}

export function checkPassword(value: string): PasswordCheck[] {
  return [
    { id: "length", label: `${String(PASSWORD_MIN_LENGTH)} caractères au minimum`, ok: Array.from(value).length >= PASSWORD_MIN_LENGTH },
    { id: "case", label: "Une majuscule et une minuscule", ok: PASSWORD_PATTERNS.mixedCase.test(value) },
    { id: "digit", label: "Un chiffre", ok: PASSWORD_PATTERNS.digit.test(value) },
    { id: "symbol", label: "Un symbole (par exemple ! ? - _)", ok: PASSWORD_PATTERNS.symbol.test(value) },
  ];
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
  const length = Array.from(value).length;
  const points = [
    length >= PASSWORD_MIN_LENGTH,
    length >= 16,
    PASSWORD_PATTERNS.mixedCase.test(value),
    PASSWORD_PATTERNS.digit.test(value),
    PASSWORD_PATTERNS.symbol.test(value),
  ].filter(Boolean).length;
  const rulesMet = checkPassword(value).every((check) => check.ok);
  if (!rulesMet) return points <= 1 ? STRENGTHS.faible : STRENGTHS.moyen;
  return points >= 5 ? STRENGTHS.excellent : STRENGTHS.bon;
}
