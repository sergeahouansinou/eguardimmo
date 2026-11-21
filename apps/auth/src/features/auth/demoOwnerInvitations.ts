import type { DemoAccount } from "./demoData";
import type { OwnerRole } from "./ownerInvitationSchemas";
import type { Profile } from "./schemas";
import type { AuthSource } from "./source";

const TOKEN_LENGTH = 48;
const VALIDITY_DAYS = 7;
const MAX_ATTEMPTS = 5;

export const DEMO_OWNER_TOKENS = {
  alex: "DemoProprioAlex".padEnd(TOKEN_LENGTH, "0"),
  marc: "DemoProprioMarc".padEnd(TOKEN_LENGTH, "0"),
  expiree: "DemoProprioExpiree".padEnd(TOKEN_LENGTH, "0"),
} as const;

export const DEMO_OWNER_CODES = { alex: "482915", marc: "246810" } as const;

interface DemoOwnerInvitation {
  organisation: string;
  email: string;
  role: OwnerRole;
  code: string;
  validityDays: number;
}

const INVITATIONS: Record<string, DemoOwnerInvitation> = {
  [DEMO_OWNER_TOKENS.alex]: { organisation: "Cabinet Delmas Immobilier", email: "sans-profil@example.com", role: "holder", code: DEMO_OWNER_CODES.alex, validityDays: VALIDITY_DAYS },
  [DEMO_OWNER_TOKENS.marc]: { organisation: "Cabinet Delmas Immobilier", email: "marc.chevalier@example.com", role: "representative", code: DEMO_OWNER_CODES.marc, validityDays: VALIDITY_DAYS },
  [DEMO_OWNER_TOKENS.expiree]: { organisation: "Cabinet Delmas Immobilier", email: "sans-profil@example.com", role: "holder", code: DEMO_OWNER_CODES.alex, validityDays: -1 },
};

type Methods = Pick<AuthSource, "previewOwnerInvitation" | "acceptOwnerInvitation">;

interface Dependencies {
  now: () => Date;
  currentAccount: () => DemoAccount | null;
}

function ownerProfile(account: DemoAccount, invitation: DemoOwnerInvitation): Profile {
  return {
    id: `${account.id}-proprietaire-${invitation.organisation.toLowerCase().replace(/\W+/g, "-")}`,
    kind: "proprietaire",
    title: "Espace propriétaire",
    subtitle: invitation.organisation,
    summary: "Premier accès",
    badge: null,
    lastUsed: false,
  };
}

export function createDemoOwnerInvitations({ now, currentAccount }: Dependencies): Methods {
  const accepted = new Set<string>();
  const blocked = new Set<string>();
  const failures = new Map<string, number>();
  let issuedAt: number | null = null;
  const expiresAt = (invitation: DemoOwnerInvitation) => {
    issuedAt ??= now().getTime();
    return new Date(issuedAt + invitation.validityDays * 86_400_000);
  };

  type Check =
    | { status: "ok"; invitation: DemoOwnerInvitation; account: DemoAccount }
    | { status: "unauthenticated" | "email_unverified" | "invalid" | "email_mismatch" };

  const check = (token: string): Check => {
    const account = currentAccount();
    if (!account) return { status: "unauthenticated" };
    if (!account.emailVerified) return { status: "email_unverified" };
    const invitation = INVITATIONS[token];
    if (!invitation || accepted.has(token) || blocked.has(token) || expiresAt(invitation).getTime() <= now().getTime()) return { status: "invalid" };
    if (invitation.email !== account.email) return { status: "email_mismatch" };
    return { status: "ok", invitation, account };
  };

  return {
    previewOwnerInvitation: (token) => {
      const result = check(token);
      if (result.status !== "ok") return Promise.resolve({ status: result.status });
      return Promise.resolve({
        status: "valid",
        organizationName: result.invitation.organisation,
        role: result.invitation.role,
        expiresAt: expiresAt(result.invitation).toISOString(),
      });
    },
    acceptOwnerInvitation: ({ token, code }) => {
      const result = check(token);
      if (result.status !== "ok") return Promise.resolve({ status: result.status });
      if (result.invitation.code !== code) {
        const count = (failures.get(token) ?? 0) + 1;
        failures.set(token, count);
        if (count >= MAX_ATTEMPTS) blocked.add(token);
        return Promise.resolve({ status: "code_invalid" });
      }
      accepted.add(token);
      result.account.profiles.push(ownerProfile(result.account, result.invitation));
      return Promise.resolve({ status: "accepted", role: result.invitation.role });
    },
  };
}
