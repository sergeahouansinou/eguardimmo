import { z } from "zod";

export const OWNER_PAIRING_CODE_LENGTH = 6;

export const ownerInvitationTokenSchema = z.string().regex(/^[A-Za-z0-9]{48}$/, "Le jeton d’invitation est invalide.");

export const OWNER_ROLES = ["holder", "representative", "co_owner"] as const;
export const ownerRoleSchema = z.enum(OWNER_ROLES);
export type OwnerRole = z.infer<typeof ownerRoleSchema>;

export const ownerPairingSchema = z.object({
  code: z.string().regex(/^\d{6}$/, "Saisissez les 6 chiffres du code remis par votre agence."),
  consent: z.boolean().refine((accepted) => accepted, { error: "Cochez la case pour accepter le rattachement de votre compte." }),
});
export type OwnerPairingValues = z.infer<typeof ownerPairingSchema>;

export const ownerInvitationPreviewSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("valid"), organizationName: z.string().min(1), role: ownerRoleSchema, expiresAt: z.iso.datetime() }),
  z.object({ status: z.literal("invalid") }),
  z.object({ status: z.literal("email_mismatch") }),
  z.object({ status: z.literal("email_unverified") }),
  z.object({ status: z.literal("unauthenticated") }),
  z.object({ status: z.literal("rate_limited"), retryAfterSeconds: z.number().int().min(1) }),
]);
export type OwnerInvitationPreview = z.infer<typeof ownerInvitationPreviewSchema>;

export const ownerInvitationPreviewResponseSchema = z.object({
  data: z.object({
    organization: z.object({ name: z.string().min(1) }),
    role: ownerRoleSchema,
    expires_at: z.string().min(1),
  }),
});

export const ownerInvitationAcceptanceResponseSchema = z.object({
  data: z.object({
    owner_link_id: z.string().min(1),
    role: ownerRoleSchema,
    organization: z.object({ id: z.string().min(1), name: z.string().nullable() }),
  }),
});
