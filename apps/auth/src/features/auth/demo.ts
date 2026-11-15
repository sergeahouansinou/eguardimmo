import {
  DEMO_IDENTITIES,
  DEMO_INVITATIONS,
  DEMO_RESET_TOKEN,
  DEMO_TOTP_CODE,
  DEMO_TOTP_SECRET,
  backupCodesForGeneration,
  seedAccounts,
} from "./demoData";
import type { DemoAccount } from "./demoData";
import type { Profile, SecurityOverview, Session } from "./schemas";
import type { AuthSource, RegisterInput, SocialSignInInput } from "./source";

const SESSION_COOKIE = "eguardimmo_demo_session";
const LOCK_SECONDS = 14 * 60;
const CODE_LOCK_SECONDS = 60;
const MAX_ATTEMPTS = 5;
const CONFIRMATION_MINUTES = 5;
const RESEND_SECONDS = 60;
const REQUEST_LIMIT = 5;

export interface SessionStore {
  read: () => string | null;
  write: (accountId: string | null) => void;
}

function browserSessionStore(): SessionStore {
  if (typeof document === "undefined") return memorySessionStore();
  return {
    read: () => {
      const match = document.cookie.split("; ").find((part) => part.startsWith(`${SESSION_COOKIE}=`));
      return match ? decodeURIComponent(match.slice(SESSION_COOKIE.length + 1)) : null;
    },
    write: (accountId) => {
      document.cookie =
        accountId === null
          ? `${SESSION_COOKIE}=; path=/; max-age=0; SameSite=Lax`
          : `${SESSION_COOKIE}=${encodeURIComponent(accountId)}; path=/; SameSite=Lax`;
    },
  };
}

export function memorySessionStore(initial: string | null = null): SessionStore {
  let value = initial;
  return { read: () => value, write: (next) => { value = next; } };
}

export interface DemoOptions {
  now?: () => Date;
  sessionStore?: SessionStore;
}

interface Counter {
  failures: number;
  lockedUntil: number;
}

function toSession(account: DemoAccount): Session {
  return {
    userId: account.id,
    firstName: account.firstName,
    lastName: account.lastName,
    email: account.email,
    hasPassword: account.password !== null,
    twoFactorEnabled: account.twoFactor.enabled,
  };
}

export function createDemoAuthSource(options: DemoOptions = {}): AuthSource {
  const now = options.now ?? (() => new Date());
  const store = options.sessionStore ?? browserSessionStore();
  let seeded: DemoAccount[] | null = null;
  const getAccounts = (): DemoAccount[] => {
    seeded ??= seedAccounts(now());
    return seeded;
  };
  const signInCounters = new Map<string, Counter>();
  const codeCounters = new Map<string, Counter>();
  const requestLog: number[] = [];
  const usedInvitations = new Set<string>();
  let challengeAccountId: string | null = null;
  let verificationSentAt: number | null = null;
  let backupGeneration = 0;
  let resetAccountId: string | null = null;
  const confirmations = new Map<string, { password: number; code: number }>();

  const findByEmail = (email: string) => getAccounts().find((account) => account.email === email.trim().toLowerCase());
  const currentAccount = () => getAccounts().find((account) => account.id === store.read()) ?? null;
  const requireAccount = (): DemoAccount => {
    const account = currentAccount();
    if (!account) throw new Error("Session requise.");
    return account;
  };

  const counter = (map: Map<string, Counter>, key: string): Counter => {
    const existing = map.get(key);
    if (existing) return existing;
    const created = { failures: 0, lockedUntil: 0 };
    map.set(key, created);
    return created;
  };
  const remaining = (entry: Counter) => Math.max(0, Math.ceil((entry.lockedUntil - now().getTime()) / 1000));
  const fail = (entry: Counter, seconds: number) => {
    entry.failures += 1;
    if (entry.failures >= MAX_ATTEMPTS) {
      entry.lockedUntil = now().getTime() + seconds * 1000;
      entry.failures = 0;
    }
  };

  const throttled = (): number => {
    const limit = now().getTime() - 60_000;
    while (requestLog.length > 0 && (requestLog[0] ?? 0) < limit) requestLog.shift();
    if (requestLog.length >= REQUEST_LIMIT) return Math.max(1, Math.ceil(((requestLog[0] ?? 0) + 60_000 - now().getTime()) / 1000));
    requestLog.push(now().getTime());
    return 0;
  };

  const openSession = (account: DemoAccount) => {
    challengeAccountId = null;
    if (!account.devices.some((device) => device.current)) {
      account.devices.push({ id: `${account.id}-safari`, name: "Safari sur Mac", type: "navigateur", location: null, lastActivityAt: now().toISOString(), current: true });
    }
    store.write(account.id);
  };

  const newAccount = (
    id: string,
    names: { firstName: string; lastName: string },
    email: string,
    password: string | null,
    profile: Profile | null,
  ): DemoAccount => {
    const created: DemoAccount = {
      id,
      ...names,
      email,
      emailVerified: false,
      password,
      passwordChangedAt: password ? now().toISOString() : null,
      twoFactor: { enabled: false, enabledAt: null, backupCodes: [], backupCodesTotal: 0 },
      links: { google: null, apple: null },
      profiles: profile ? [profile] : [],
      devices: [{ id: `${id}-safari`, name: "Safari sur Mac", type: "navigateur", location: null, lastActivityAt: now().toISOString(), current: true }],
    };
    getAccounts().push(created);
    return created;
  };

  const profileFor = (input: RegisterInput, id: string): Profile => {
    if (input.profile === "agence") {
      return { id, kind: "agence", title: "Espace agence", subtitle: `${input.agencyName} · administrateur`, summary: "Essai gratuit d’un mois", badge: { label: "Essai", tone: "info" }, lastUsed: true };
    }
    if (input.profile === "bailleur") {
      return { id, kind: "bailleur", title: "Espace bailleur", subtitle: `${input.firstName} ${input.lastName}`, summary: "Aucun bien pour le moment", badge: null, lastUsed: true };
    }
    return { id, kind: "voyageur", title: "Espace voyageur", subtitle: "SeBook", summary: "Aucun séjour à venir", badge: null, lastUsed: true };
  };

  const socialProfile = (input: SocialSignInInput, id: string): Profile => {
    if (input.intent === "invitation") {
      return { id, kind: "locataire", title: "Espace locataire", subtitle: "Gestion Les Tilleuls", summary: "Premier accès", badge: null, lastUsed: true };
    }
    const placeholder = { firstName: "Nouveau", lastName: "Client", email: DEMO_IDENTITIES.find((candidate) => candidate.id === input.identityId)?.email ?? "" };
    if (input.profile === "agence") return profileFor({ profile: "agence", agencyName: "Nouvelle agence", siren: "", email: placeholder.email, password: "" }, id);
    if (input.profile === "voyageur") return profileFor({ profile: "voyageur", ...placeholder, password: "" }, id);
    return profileFor({ profile: "bailleur", ...placeholder, password: "" }, id);
  };

  const confirmationState = (account: DemoAccount) => confirmations.get(account.id) ?? { password: 0, code: 0 };
  const isRecent = (until: number) => until > now().getTime();
  const guard = (account: DemoAccount, strong = false): { status: "confirmation_required"; needsCode: boolean } | null => {
    const state = confirmationState(account);
    const needsCode = strong && account.twoFactor.enabled;
    if (needsCode ? isRecent(state.code) : isRecent(state.password) || isRecent(state.code)) return null;
    return { status: "confirmation_required", needsCode };
  };
  const stamp = (account: DemoAccount, withCode: boolean) => {
    const until = now().getTime() + CONFIRMATION_MINUTES * 60_000;
    const state = confirmationState(account);
    confirmations.set(account.id, { password: until, code: withCode ? until : state.code });
  };

  const checkTotp = (account: DemoAccount, code: string) => code.replace(/\s/g, "") === DEMO_TOTP_CODE && account.twoFactor.enabled;

  const loginResult = (account: DemoAccount): { status: "authenticated" } | { status: "two_factor_required" } => {
    if (account.twoFactor.enabled) {
      challengeAccountId = account.id;
      return { status: "two_factor_required" };
    }
    openSession(account);
    return { status: "authenticated" };
  };

  const security = (account: DemoAccount): SecurityOverview => {
    const state = confirmationState(account);
    const iso = (until: number) => (isRecent(until) ? new Date(until).toISOString() : null);
    return {
      email: account.email,
      emailVerified: account.emailVerified,
      hasPassword: account.password !== null,
      passwordChangedAt: account.passwordChangedAt,
      twoFactor: {
        enabled: account.twoFactor.enabled,
        enabledAt: account.twoFactor.enabledAt,
        backupCodesRemaining: account.twoFactor.backupCodes.length,
        backupCodesTotal: account.twoFactor.backupCodesTotal,
      },
      linkedAccounts: (["google", "apple"] as const).map((provider) => {
        const link = account.links[provider];
        return { provider, linked: link !== null, email: link?.email ?? null, linkedAt: link?.linkedAt ?? null };
      }),
      devices: account.devices,
      confirmedUntil: iso(Math.max(state.password, state.code)),
      confirmedWithCodeUntil: iso(state.code),
    };
  };

  const completeTwoFactor = (): ReturnType<AuthSource["verifyTwoFactor"]> => {
    const account = getAccounts().find((candidate) => candidate.id === challengeAccountId);
    if (!account) return Promise.resolve({ status: "challenge_expired" });
    openSession(account);
    return Promise.resolve({ status: "authenticated" });
  };

  const verifyChallenge = (accepts: (account: DemoAccount) => boolean): ReturnType<AuthSource["verifyTwoFactor"]> => {
    const account = getAccounts().find((candidate) => candidate.id === challengeAccountId);
    if (!account) return Promise.resolve({ status: "challenge_expired" });
    const entry = counter(codeCounters, account.id);
    if (remaining(entry) > 0) return Promise.resolve({ status: "locked", retryAfterSeconds: remaining(entry) });
    if (!accepts(account)) {
      fail(entry, CODE_LOCK_SECONDS);
      return Promise.resolve({ status: "invalid_code" });
    }
    entry.failures = 0;
    return completeTwoFactor();
  };

  const confirmWith = (accepts: (account: DemoAccount) => boolean, withCode: boolean) => {
    const account = requireAccount();
    const entry = counter(codeCounters, `confirm-${account.id}`);
    if (remaining(entry) > 0) return Promise.resolve({ status: "locked" as const, retryAfterSeconds: remaining(entry) });
    if (!accepts(account)) {
      fail(entry, CODE_LOCK_SECONDS);
      return Promise.resolve({ status: "invalid" as const });
    }
    entry.failures = 0;
    stamp(account, withCode);
    return Promise.resolve({ status: "confirmed" as const });
  };

  const social = (input: SocialSignInInput) => {
    const identity = DEMO_IDENTITIES.find((candidate) => candidate.id === input.identityId);
    const existing = identity?.accountId ? getAccounts().find((account) => account.id === identity.accountId) : undefined;
    if (!identity) return { status: "account_not_found" as const };
    if (existing) {
      if (!identity.linked) return { status: "link_required" as const };
      return loginResult(existing);
    }
    if (input.intent === "connexion") return { status: "account_not_found" as const };
    const id = `nouveau-${String(getAccounts().length)}`;
    const created = newAccount(id, { firstName: "Nouveau", lastName: "Client" }, identity.email, null, null);
    created.profiles = [socialProfile(input, `${id}-profil`)];
    created.emailVerified = true;
    created.links[input.provider] = { email: identity.email, linkedAt: now().toISOString() };
    openSession(created);
    return { status: "authenticated" as const };
  };

  const source: AuthSource = {
    kind: "demo",
    now,
    getSession: () => {
      const account = currentAccount();
      return Promise.resolve(account ? toSession(account) : null);
    },
    signIn: ({ email, password }) => {
      const key = email.trim().toLowerCase();
      const entry = counter(signInCounters, key);
      if (remaining(entry) > 0) return Promise.resolve({ status: "locked", retryAfterSeconds: remaining(entry) });
      const account = findByEmail(key);
      if (account?.password !== password) {
        fail(entry, LOCK_SECONDS);
        return Promise.resolve(remaining(entry) > 0 ? { status: "locked", retryAfterSeconds: remaining(entry) } : { status: "invalid_credentials" });
      }
      entry.failures = 0;
      return Promise.resolve(loginResult(account));
    },
    verifyTwoFactor: (code) => verifyChallenge((account) => checkTotp(account, code)),
    verifyBackupCode: (code) =>
      verifyChallenge((account) => {
        const normalized = code.replace(/[\s-]/g, "").toLowerCase();
        const index = account.twoFactor.backupCodes.findIndex((candidate) => candidate.replace("-", "") === normalized);
        if (index < 0) return false;
        account.twoFactor.backupCodes.splice(index, 1);
        return true;
      }),
    socialIdentities: () =>
      DEMO_IDENTITIES.map((identity) => ({ id: identity.id, label: identity.email, description: identity.description })),
    socialSignIn: (input) => Promise.resolve(social(input)),
    signOut: () => {
      store.write(null);
      challengeAccountId = null;
      return Promise.resolve();
    },
    register: (input) => {
      const wait = throttled();
      if (wait > 0) return Promise.resolve({ status: "rate_limited", retryAfterSeconds: wait });
      const email = input.email.trim().toLowerCase();
      if (!findByEmail(email)) {
        const names = input.profile === "agence" ? { firstName: "Responsable", lastName: input.agencyName } : { firstName: input.firstName, lastName: input.lastName };
        const created = newAccount(`nouveau-${String(getAccounts().length)}`, names, email, input.password, null);
        created.profiles = [profileFor(input, `${created.id}-profil`)];
        openSession(created);
      }
      verificationSentAt = now().getTime();
      return Promise.resolve({ status: "sent" });
    },
    getVerificationStatus: () => {
      const elapsed = verificationSentAt === null ? RESEND_SECONDS : Math.floor((now().getTime() - verificationSentAt) / 1000);
      return Promise.resolve({ resendAvailableInSeconds: Math.max(0, RESEND_SECONDS - elapsed) });
    },
    resendVerification: () => {
      const elapsed = verificationSentAt === null ? RESEND_SECONDS : Math.floor((now().getTime() - verificationSentAt) / 1000);
      if (elapsed < RESEND_SECONDS) return Promise.resolve({ status: "rate_limited", retryAfterSeconds: RESEND_SECONDS - elapsed });
      verificationSentAt = now().getTime();
      return Promise.resolve({ status: "sent" });
    },
    verifyEmail: (token) => {
      if (token !== DEMO_RESET_TOKEN) return Promise.resolve({ status: "expired" });
      const account = currentAccount();
      if (account) account.emailVerified = true;
      return Promise.resolve({ status: "verified" });
    },
    requestPasswordReset: (email) => {
      const wait = throttled();
      if (wait > 0) return Promise.resolve({ status: "rate_limited", retryAfterSeconds: wait });
      resetAccountId = findByEmail(email)?.id ?? null;
      return Promise.resolve({ status: "sent" });
    },
    checkResetToken: ({ token }) => Promise.resolve({ status: token === DEMO_RESET_TOKEN ? "valid" : "expired" }),
    resetPassword: ({ token, password }) => {
      if (token !== DEMO_RESET_TOKEN) return Promise.resolve({ status: "expired" });
      const account = getAccounts().find((candidate) => candidate.id === resetAccountId) ?? currentAccount();
      if (account?.password === password) return Promise.resolve({ status: "reused" });
      if (account) {
        account.password = password;
        account.passwordChangedAt = now().toISOString();
        account.devices = [];
      }
      store.write(null);
      return Promise.resolve({ status: "ok" });
    },
    requestPasswordDefinition: () => {
      const wait = throttled();
      if (wait > 0) return Promise.resolve({ status: "rate_limited", retryAfterSeconds: wait });
      resetAccountId = currentAccount()?.id ?? null;
      return Promise.resolve({ status: "sent" });
    },
    getInvitation: (token) => {
      const invitation = DEMO_INVITATIONS[token];
      return Promise.resolve(invitation && !usedInvitations.has(token) ? { status: "valid", invitation } : { status: "invalid" });
    },
    acceptInvitation: ({ token, password }) => {
      const invitation = DEMO_INVITATIONS[token];
      if (!invitation || usedInvitations.has(token)) return Promise.resolve({ status: "invalid" });
      usedInvitations.add(token);
      const existing = findByEmail(invitation.email);
      if (existing) {
        existing.password = password;
        existing.passwordChangedAt = now().toISOString();
      }
      return Promise.resolve({ status: "activated" });
    },
    listProfiles: () => Promise.resolve(requireAccount().profiles),
    selectProfile: (profileId) => {
      for (const profile of requireAccount().profiles) profile.lastUsed = profile.id === profileId;
      return Promise.resolve();
    },
    getSecurity: () => Promise.resolve(security(requireAccount())),
    confirmPassword: (password) => confirmWith((account) => account.password !== null && account.password === password, false),
    confirmCode: (code) => confirmWith((account) => checkTotp(account, code), true),
    changePassword: ({ current, password }) => {
      const account = requireAccount();
      if (account.password !== current) return Promise.resolve({ status: "invalid_current" });
      account.password = password;
      account.passwordChangedAt = now().toISOString();
      account.devices = account.devices.filter((device) => device.current);
      return Promise.resolve({ status: "ok" });
    },
    changeEmail: () => Promise.resolve(guard(requireAccount()) ?? { status: "ok" }),
    startTwoFactorSetup: () =>
      Promise.resolve({ secret: DEMO_TOTP_SECRET, otpauthUri: `otpauth://totp/eGuardImmo:${requireAccount().email}?secret=${DEMO_TOTP_SECRET}&issuer=eGuardImmo` }),
    enableTwoFactor: (code) => {
      const account = requireAccount();
      const blocked = guard(account);
      if (blocked) return Promise.resolve(blocked);
      if (code.replace(/\s/g, "") !== DEMO_TOTP_CODE) return Promise.resolve({ status: "invalid_code" });
      backupGeneration += 1;
      const backupCodes = backupCodesForGeneration(backupGeneration);
      account.twoFactor = { enabled: true, enabledAt: now().toISOString(), backupCodes: [...backupCodes], backupCodesTotal: backupCodes.length };
      return Promise.resolve({ status: "ok", backupCodes });
    },
    disableTwoFactor: () => {
      const account = requireAccount();
      const blocked = guard(account);
      if (blocked) return Promise.resolve(blocked);
      account.twoFactor = { enabled: false, enabledAt: null, backupCodes: [], backupCodesTotal: 0 };
      return Promise.resolve({ status: "ok" });
    },
    regenerateBackupCodes: () => {
      const account = requireAccount();
      const blocked = guard(account);
      if (blocked) return Promise.resolve(blocked);
      backupGeneration += 1;
      const backupCodes = backupCodesForGeneration(backupGeneration);
      account.twoFactor.backupCodes = [...backupCodes];
      account.twoFactor.backupCodesTotal = backupCodes.length;
      return Promise.resolve({ status: "ok", backupCodes });
    },
    linkProvider: ({ provider, identityId }) => {
      const account = requireAccount();
      const blocked = guard(account);
      if (blocked) return Promise.resolve(blocked);
      const identity = DEMO_IDENTITIES.find((candidate) => candidate.id === identityId);
      if (!identity || (identity.accountId !== null && identity.accountId !== account.id)) return Promise.resolve({ status: "conflict" });
      account.links[provider] = { email: identity.email, linkedAt: now().toISOString() };
      return Promise.resolve({ status: "ok" });
    },
    unlinkProvider: (provider) => {
      const account = requireAccount();
      const blocked = guard(account);
      if (blocked) return Promise.resolve(blocked);
      const others = (["google", "apple"] as const).filter((candidate) => candidate !== provider && account.links[candidate] !== null);
      if (account.password === null && others.length === 0) return Promise.resolve({ status: "last_login_method" });
      account.links[provider] = null;
      return Promise.resolve({ status: "ok" });
    },
    signOutDevice: (deviceId) => {
      const account = requireAccount();
      account.devices = account.devices.filter((device) => device.id !== deviceId || device.current);
      return Promise.resolve();
    },
    signOutOtherDevices: () => {
      const account = requireAccount();
      account.devices = account.devices.filter((device) => device.current);
      return Promise.resolve();
    },
    deleteAccount: () => {
      const account = requireAccount();
      const blocked = guard(account, true);
      if (blocked) return Promise.resolve(blocked);
      getAccounts().splice(getAccounts().indexOf(account), 1);
      store.write(null);
      return Promise.resolve({ status: "deleted" });
    },
  };
  return source;
}
