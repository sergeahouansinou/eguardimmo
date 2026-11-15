import { z } from "zod";

export const MIN_PASSWORD_LENGTHS = [8, 10, 12, 14, 16] as const;

export const PASSWORD_LENGTH_OPTIONS = MIN_PASSWORD_LENGTHS.map((length) => ({
  value: String(length),
  label: `${String(length)} caractères`,
}));

export const MIN_LENGTH_VALUES = { 8: "8", 10: "10", 12: "12", 14: "14", 16: "16" } as const;

const minLengthSchema = z.union([z.literal(8), z.literal(10), z.literal(12), z.literal(14), z.literal(16)]);

export const deviceSchema = z.object({
  id: z.string(),
  label: z.string(),
  lastSeen: z.string(),
  current: z.boolean(),
});
export type Device = z.infer<typeof deviceSchema>;

export const loginEventSchema = z.object({
  id: z.string(),
  at: z.string(),
  device: z.string(),
  outcome: z.enum(["success", "failure"]),
  newDevice: z.boolean(),
});
export type LoginEvent = z.infer<typeof loginEventSchema>;

export const securitySchema = z.object({
  rules: z.object({ twoFactorRequired: z.boolean(), minPasswordLength: minLengthSchema }),
  team: z.object({ covered: z.number().int(), total: z.number().int(), withoutTwoFactor: z.array(z.string()) }),
  connection: z.object({
    passwordChangedAt: z.string(),
    passwordStrength: z.enum(["Forte", "Correcte", "Faible"]),
    twoFactorMethod: z.string(),
    backupCodes: z.number().int(),
    devices: z.array(deviceSchema),
    log: z.array(loginEventSchema),
    lastLoginAt: z.string().nullable(),
    failuresLast30Days: z.number().int(),
    lastNewDeviceAt: z.string().nullable(),
  }),
});
export type SecurityOverview = z.infer<typeof securitySchema>;

export const securityRulesInputSchema = z.object({
  twoFactorRequired: z.boolean(),
  minPasswordLength: z.enum(["8", "10", "12", "14", "16"]),
});
export type SecurityRulesInput = z.input<typeof securityRulesInputSchema>;

export function passwordChangeSchema(minLength: number) {
  return z
    .object({
      currentPassword: z.string().min(1, "Saisissez votre mot de passe actuel."),
      newPassword: z.string().min(minLength, `Le mot de passe doit contenir au moins ${String(minLength)} caractères.`),
      confirmPassword: z.string().min(1, "Confirmez le nouveau mot de passe."),
    })
    .superRefine((value, ctx) => {
      if (value.confirmPassword !== "" && value.confirmPassword !== value.newPassword) {
        ctx.addIssue({ code: "custom", path: ["confirmPassword"], message: "Les deux mots de passe ne correspondent pas." });
      }
      if (value.newPassword !== "" && value.newPassword === value.currentPassword) {
        ctx.addIssue({ code: "custom", path: ["newPassword"], message: "Choisissez un mot de passe différent de l'actuel." });
      }
    });
}
export type PasswordChangeInput = z.input<ReturnType<typeof passwordChangeSchema>>;
