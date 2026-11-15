import { z } from "zod";
import { INVITABLE_ROLE_IDS, ROLE_IDS } from "./rights";

export const portfolioModeSchema = z.enum(["all", "chosen"]);
export type PortfolioMode = z.infer<typeof portfolioModeSchema>;

export const memberSchema = z.object({
  id: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  email: z.string(),
  role: z.enum(ROLE_IDS),
  portfolioMode: portfolioModeSchema,
  mandantIds: z.array(z.string()),
  portfolioLabel: z.string(),
  twoFactor: z.enum(["enabled", "disabled", "at_acceptance"]),
  status: z.enum(["active", "invited", "inactive"]),
  lastLogin: z.string().nullable(),
  online: z.boolean(),
  invitedAt: z.string().nullable(),
  isCurrentUser: z.boolean(),
});
export type Member = z.infer<typeof memberSchema>;

export const seatsSchema = z.object({
  planName: z.string(),
  limit: z.number().int(),
  active: z.number().int(),
  pending: z.number().int(),
  used: z.number().int(),
});
export type Seats = z.infer<typeof seatsSchema>;

export const equipeOverviewSchema = z.object({
  members: z.array(memberSchema),
  seats: seatsSchema,
});
export type EquipeOverview = z.infer<typeof equipeOverviewSchema>;

const portfolioFields = {
  portfolioMode: portfolioModeSchema,
  mandantIds: z.array(z.string()),
};

function requireChosenMandants(value: { portfolioMode: PortfolioMode; mandantIds: readonly string[] }, ctx: z.RefinementCtx): void {
  if (value.portfolioMode === "chosen" && value.mandantIds.length === 0) {
    ctx.addIssue({ code: "custom", path: ["mandantIds"], message: "Choisissez au moins un mandant." });
  }
}

export const inviteInputSchema = z
  .object({
    firstName: z.string().trim().min(1, "Le prénom est obligatoire."),
    lastName: z.string().trim().min(1, "Le nom est obligatoire."),
    email: z.string().trim().pipe(z.email("Saisissez une adresse e-mail valide.")),
    role: z.enum(INVITABLE_ROLE_IDS),
    ...portfolioFields,
    message: z.string().trim().max(500, "Le message ne peut pas dépasser 500 caractères."),
  })
  .superRefine(requireChosenMandants);
export type InviteInput = z.input<typeof inviteInputSchema>;

export const updateMemberInputSchema = z
  .object({
    id: z.string().min(1),
    role: z.enum(INVITABLE_ROLE_IDS),
    ...portfolioFields,
  })
  .superRefine(requireChosenMandants);
export type UpdateMemberInput = z.input<typeof updateMemberInputSchema>;

export const memberIdSchema = z.string().min(1);

export interface TeamStats {
  activeCount: number;
  pendingCount: number;
  twoFactorCovered: number;
  twoFactorTotal: number;
  withoutTwoFactor: readonly string[];
}
