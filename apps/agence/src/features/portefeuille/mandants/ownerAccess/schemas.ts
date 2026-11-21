import { z } from "zod";

export const OWNER_ROLES = ["holder", "representative", "co_owner"] as const;
export const ownerRoleSchema = z.enum(OWNER_ROLES);
export type OwnerRole = z.infer<typeof ownerRoleSchema>;

const invitationSchema = z.object({
  id: z.uuid(),
  role: ownerRoleSchema,
  person_party_id: z.uuid().nullable(),
  email_hint: z.string().nullable(),
  expires_at: z.string().min(1),
  attempts_remaining: z.number().int().min(0),
});

const accessSchema = z.object({
  id: z.uuid(),
  role: ownerRoleSchema,
  person_party_id: z.uuid().nullable(),
  email_hint: z.string().nullable(),
  linked_at: z.string().min(1),
});

export const ownerAccessStateSchema = z.object({
  data: z.object({ party_id: z.uuid(), accesses: z.array(accessSchema), invitations: z.array(invitationSchema) }),
});

export const issuedInvitationSchema = z.object({
  data: z.object({ party_id: z.uuid(), invitation: invitationSchema, pairing_code: z.string().regex(/^\d{6}$/) }),
});

export type OwnerAccessState = z.infer<typeof ownerAccessStateSchema>["data"];
export type OwnerAccessEntry = OwnerAccessState["accesses"][number];
export type OwnerInvitationEntry = OwnerAccessState["invitations"][number];
export type IssuedInvitation = z.infer<typeof issuedInvitationSchema>["data"];

export const NO_PERSON = "none";

export const inviteFormSchema = z
  .object({
    role: ownerRoleSchema,
    personPartyId: z.string(),
    email: z.string().trim(),
    identityVerified: z.boolean(),
    powersVerified: z.boolean(),
  })
  .superRefine((values, context) => {
    if (values.email !== "" && !z.email().safeParse(values.email).success) {
      context.addIssue({ code: "custom", path: ["email"], message: "Saisissez une adresse e-mail valide, par exemple awa.dossou@example.com." });
    }
    if (values.role === "co_owner" && (values.personPartyId === "" || values.personPartyId === NO_PERSON)) {
      context.addIssue({ code: "custom", path: ["personPartyId"], message: "Choisissez la fiche du co-indivisaire à inviter." });
    }
    if (!values.identityVerified) {
      context.addIssue({ code: "custom", path: ["identityVerified"], message: "Attestez avoir vérifié l’identité du mandant pour envoyer l’invitation." });
    }
    if (values.role === "representative" && !values.powersVerified) {
      context.addIssue({ code: "custom", path: ["powersVerified"], message: "Attestez avoir vérifié les pouvoirs du représentant pour envoyer l’invitation." });
    }
  });

export type InviteFormValues = z.infer<typeof inviteFormSchema>;

export interface InvitePayload {
  role: OwnerRole;
  person_party_id?: string;
  email?: string;
  identity_verified: true;
  powers_verified: boolean;
}

export function toInvitePayload(values: InviteFormValues): InvitePayload {
  const person = values.role === "holder" || values.personPartyId === NO_PERSON ? "" : values.personPartyId;
  return {
    role: values.role,
    ...(person === "" ? {} : { person_party_id: person }),
    ...(values.email === "" ? {} : { email: values.email }),
    identity_verified: true,
    powers_verified: values.role === "representative" && values.powersVerified,
  };
}
