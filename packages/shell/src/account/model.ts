export interface AccountIdentity {
  id: string;
  name: string;
  email: string;
  emailVerifiedAt: string | null;
  lastLoginAt: string | null;
  previousLoginAt: string | null;
}

export type LinkedProvider = 'google' | 'apple';

export interface AccountSecurity {
  email: string;
  emailVerified: boolean;
  hasPassword: boolean;
  twoFactor: { enabled: boolean; enabledAt: string | null; backupCodesRemaining: number; backupCodesTotal: number };
  linkedAccounts: { provider: LinkedProvider; linked: boolean; email: string | null; linkedAt: string | null }[];
}

export interface AccountDevice {
  id: string;
  name: string;
  lastUsedAt: string | null;
  createdAt: string | null;
  current: boolean;
}
