import { z } from "zod";
import { PASSWORD_MIN_LENGTH } from "@/lib/password";

export const emailSchema = z
  .string()
  .trim()
  .min(1, "Saisissez votre adresse e-mail.")
  .pipe(z.email("Cette adresse e-mail n’est pas valide."));

export const newPasswordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Le mot de passe doit contenir au moins ${String(PASSWORD_MIN_LENGTH)} caractères.`)
  .regex(/[A-Z]/, "Ajoutez au moins une majuscule.")
  .regex(/\d/, "Ajoutez au moins un chiffre.");

const requiredText = (message: string) => z.string().trim().min(1, message).max(120, "Texte trop long.");

const termsSchema = z.boolean().refine((accepted) => accepted, { error: "Acceptez les conditions d’utilisation pour continuer." });

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Saisissez votre mot de passe."),
});
export type SignInValues = z.infer<typeof signInSchema>;

export const registerBailleurSchema = z.object({
  firstName: requiredText("Saisissez votre prénom."),
  lastName: requiredText("Saisissez votre nom."),
  email: emailSchema,
  password: newPasswordSchema,
  acceptTerms: termsSchema,
});
export type RegisterBailleurValues = z.infer<typeof registerBailleurSchema>;


export const registerAgenceSchema = z.object({
  agencyName: requiredText("Saisissez le nom de l’agence."),
  siren: z.string().trim().regex(/^\d{3}\s?\d{3}\s?\d{3}$/, "Le SIREN comporte 9 chiffres."),
  email: emailSchema,
  password: newPasswordSchema,
  acceptTerms: termsSchema,
});
export type RegisterAgenceValues = z.infer<typeof registerAgenceSchema>;

export const invitationSchema = z.object({
  password: newPasswordSchema,
  acceptTerms: termsSchema,
});
export type InvitationValues = z.infer<typeof invitationSchema>;

export const forgotPasswordSchema = z.object({ email: emailSchema });
export type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z
  .object({
    password: newPasswordSchema,
    confirmation: z.string().min(1, "Confirmez le mot de passe."),
  })
  .refine((values) => values.password === values.confirmation, {
    path: ["confirmation"],
    error: "Les deux mots de passe ne correspondent pas.",
  });
export type ResetPasswordValues = z.infer<typeof resetPasswordSchema>;

export const changePasswordSchema = z
  .object({
    current: z.string().min(1, "Saisissez votre mot de passe actuel."),
    password: newPasswordSchema,
    confirmation: z.string().min(1, "Confirmez le mot de passe."),
  })
  .refine((values) => values.password === values.confirmation, {
    path: ["confirmation"],
    error: "Les deux mots de passe ne correspondent pas.",
  })
  .refine((values) => values.password !== values.current, {
    path: ["password"],
    error: "Choisissez un mot de passe différent de l’ancien.",
  });
export type ChangePasswordValues = z.infer<typeof changePasswordSchema>;

export const changeEmailSchema = z.object({ email: emailSchema });
export type ChangeEmailValues = z.infer<typeof changeEmailSchema>;

export const confirmPasswordSchema = z.object({
  password: z.string().min(1, "Saisissez votre mot de passe."),
});
export type ConfirmPasswordValues = z.infer<typeof confirmPasswordSchema>;

export const totpCodeSchema = z
  .string()
  .transform((value) => value.replace(/\s/g, ""))
  .pipe(z.string().regex(/^\d{6}$/, "Le code comporte 6 chiffres."));

export const backupCodeFormSchema = z.object({
  code: z
    .string()
    .trim()
    .regex(
      /^(?:[A-Za-z0-9]{10}-[A-Za-z0-9]{10}|[A-Za-z0-9]{5}-?[A-Za-z0-9]{5})$/,
      "Un code de secours comporte deux blocs de 10 caractères séparés par un tiret, par exemple k3Jx9aQw2L-p0Zr7Tm4Vn.",
    ),
});
export type BackupCodeValues = z.infer<typeof backupCodeFormSchema>;

export const DELETE_CONFIRMATION_WORD = "SUPPRIMER";
export const deleteAccountSchema = z.object({
  confirmation: z
    .string()
    .trim()
    .refine((value): boolean => value === DELETE_CONFIRMATION_WORD, { error: `Saisissez ${DELETE_CONFIRMATION_WORD} pour confirmer.` }),
});
export type DeleteAccountValues = z.infer<typeof deleteAccountSchema>;

export const providerSchema = z.enum(["google", "apple"]);
export type SocialProvider = z.infer<typeof providerSchema>;

export const profileKindSchema = z.enum(["agence", "bailleur", "proprietaire", "locataire", "voyageur"]);
export const registerProfileSchema = z.enum(["bailleur", "agence", "voyageur"]);
export type RegisterProfile = z.infer<typeof registerProfileSchema>;

export const sessionSchema = z.object({
  userId: z.string().min(1),
  firstName: z.string().min(1),
  lastName: z.string(),
  email: z.email(),
  hasPassword: z.boolean().optional(),
  twoFactorEnabled: z.boolean().optional(),
});
export type Session = z.infer<typeof sessionSchema>;

export const profileSchema = z.object({
  id: z.string().min(1),
  kind: profileKindSchema,
  title: z.string().min(1),
  subtitle: z.string().min(1),
  summary: z.string().min(1),
  badge: z.object({ label: z.string().min(1), tone: z.enum(["neutral", "info", "success", "warning", "danger"]) }).nullable(),
  lastUsed: z.boolean(),
});
export type Profile = z.infer<typeof profileSchema>;

export const deviceSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  type: z.enum(["mobile", "navigateur"]),
  location: z.string().nullable(),
  lastActivityAt: z.iso.datetime(),
  current: z.boolean(),
});
export type Device = z.infer<typeof deviceSchema>;

export const linkedAccountSchema = z.object({
  provider: providerSchema,
  linked: z.boolean(),
  email: z.string().nullable(),
  linkedAt: z.iso.datetime().nullable(),
});
export type LinkedAccount = z.infer<typeof linkedAccountSchema>;

export const securitySchema = z.object({
  email: z.email(),
  emailVerified: z.boolean(),
  hasPassword: z.boolean(),
  passwordChangedAt: z.iso.datetime().nullable(),
  twoFactor: z.object({
    enabled: z.boolean(),
    enabledAt: z.iso.datetime().nullable(),
    backupCodesRemaining: z.number().int().min(0),
    backupCodesTotal: z.number().int().min(0),
  }),
  linkedAccounts: z.array(linkedAccountSchema),
  devices: z.array(deviceSchema),
  confirmedUntil: z.iso.datetime().nullable(),
  confirmedWithCodeUntil: z.iso.datetime().nullable(),
});
export type SecurityOverview = z.infer<typeof securitySchema>;

export const invitationDetailSchema = z.object({
  kind: z.enum(["locataire", "proprietaire"]),
  organisation: z.string().min(1),
  reference: z.string().min(1),
  email: z.email(),
  expiresAt: z.iso.datetime(),
});
export type InvitationDetail = z.infer<typeof invitationDetailSchema>;

export const verificationStatusSchema = z.object({
  resendAvailableInSeconds: z.number().int().min(0),
});
export type VerificationStatus = z.infer<typeof verificationStatusSchema>;
