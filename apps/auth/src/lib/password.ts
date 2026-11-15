export const PASSWORD_MIN_LENGTH = 12;

export interface PasswordCheck {
  id: "length" | "case";
  label: string;
  ok: boolean;
}

export function checkPassword(value: string): PasswordCheck[] {
  return [
    { id: "length", label: `${String(PASSWORD_MIN_LENGTH)} caractères au minimum`, ok: value.length >= PASSWORD_MIN_LENGTH },
    { id: "case", label: "Une majuscule et un chiffre", ok: /[A-Z]/.test(value) && /\d/.test(value) },
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
  const points = [
    value.length >= PASSWORD_MIN_LENGTH,
    value.length >= 16,
    /[A-Z]/.test(value) && /[a-z]/.test(value),
    /\d/.test(value),
    /[^A-Za-z0-9]/.test(value),
  ].filter(Boolean).length;
  const rulesMet = checkPassword(value).every((check) => check.ok);
  if (!rulesMet) return points <= 1 ? STRENGTHS.faible : STRENGTHS.moyen;
  return points >= 5 ? STRENGTHS.excellent : STRENGTHS.bon;
}
