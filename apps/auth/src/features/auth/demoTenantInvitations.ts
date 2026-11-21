import type { DemoAccount } from "./demoData";
import type { Profile } from "./schemas";
import type { AuthSource } from "./source";

const TOKEN_LENGTH = 48;
const VALIDITY_DAYS = 7;

export const DEMO_TENANT_TOKENS = {
  koffi: "DemoKoffi".padEnd(TOKEN_LENGTH, "0"),
  alex: "DemoAlex".padEnd(TOKEN_LENGTH, "0"),
  marc: "DemoMarc".padEnd(TOKEN_LENGTH, "0"),
  expiree: "DemoExpiree".padEnd(TOKEN_LENGTH, "0"),
} as const;

interface DemoTenantInvitation {
  organisation: string;
  email: string;
  validityDays: number;
  conflict: boolean;
}

const INVITATIONS: Record<string, DemoTenantInvitation> = {
  [DEMO_TENANT_TOKENS.koffi]: { organisation: "Gestion Les Tilleuls", email: "koffi.adjovi@example.com", validityDays: VALIDITY_DAYS, conflict: false },
  [DEMO_TENANT_TOKENS.alex]: { organisation: "Cabinet Delmas Immobilier", email: "sans-profil@example.com", validityDays: VALIDITY_DAYS, conflict: false },
  [DEMO_TENANT_TOKENS.marc]: { organisation: "Gestion Les Tilleuls", email: "marc.chevalier@example.com", validityDays: VALIDITY_DAYS, conflict: true },
  [DEMO_TENANT_TOKENS.expiree]: { organisation: "Gestion Les Tilleuls", email: "koffi.adjovi@example.com", validityDays: -1, conflict: false },
};

type Methods = Pick<AuthSource, "previewTenantInvitation" | "acceptTenantInvitation">;

interface Dependencies {
  now: () => Date;
  currentAccount: () => DemoAccount | null;
}

function tenantProfile(account: DemoAccount, organisation: string): Profile {
  return {
    id: `${account.id}-locataire-${organisation.toLowerCase().replace(/\W+/g, "-")}`,
    kind: "locataire",
    title: "Espace locataire",
    subtitle: organisation,
    summary: "Premier accès",
    badge: null,
    lastUsed: false,
  };
}

export function createDemoTenantInvitations({ now, currentAccount }: Dependencies): Methods {
  const accepted = new Set<string>();
  let issuedAt: number | null = null;
  const expiresAt = (invitation: DemoTenantInvitation) => {
    issuedAt ??= now().getTime();
    return new Date(issuedAt + invitation.validityDays * 86_400_000);
  };

  type Check =
    | { status: "ok"; invitation: DemoTenantInvitation; account: DemoAccount }
    | { status: "unauthenticated" | "email_unverified" | "invalid" | "email_mismatch" };

  const check = (token: string): Check => {
    const account = currentAccount();
    if (!account) return { status: "unauthenticated" };
    if (!account.emailVerified) return { status: "email_unverified" };
    const invitation = INVITATIONS[token];
    if (!invitation || accepted.has(token) || expiresAt(invitation).getTime() <= now().getTime()) return { status: "invalid" };
    if (invitation.email !== account.email) return { status: "email_mismatch" };
    return { status: "ok", invitation, account };
  };

  return {
    previewTenantInvitation: (token) => {
      const result = check(token);
      if (result.status !== "ok") return Promise.resolve({ status: result.status });
      return Promise.resolve({
        status: "valid",
        organizationName: result.invitation.organisation,
        expiresAt: expiresAt(result.invitation).toISOString(),
      });
    },
    acceptTenantInvitation: ({ token }) => {
      const result = check(token);
      if (result.status !== "ok") return Promise.resolve({ status: result.status });
      if (result.invitation.conflict) return Promise.resolve({ status: "account_already_linked" });
      accepted.add(token);
      result.account.profiles.push(tenantProfile(result.account, result.invitation.organisation));
      return Promise.resolve({ status: "accepted" });
    },
  };
}
