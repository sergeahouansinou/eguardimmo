import type { Device, Profile, SocialProvider } from "./schemas";

export const DEMO_PASSWORD = "MotDePasse-2026";
export const DEMO_TOTP_CODE = "481305";
export const DEMO_TOTP_SECRET = "JBSWY3DPEHPK3PXP";
export const DEMO_RESET_TOKEN = "valide";

export interface DemoLink {
  email: string;
  linkedAt: string;
}

export interface DemoAccount {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  emailVerified: boolean;
  password: string | null;
  passwordChangedAt: string | null;
  twoFactor: { enabled: boolean; enabledAt: string | null; backupCodes: string[]; backupCodesTotal: number };
  links: Record<SocialProvider, DemoLink | null>;
  profiles: Profile[];
  devices: Device[];
}

export interface DemoIdentity {
  id: string;
  email: string;
  description: string;
  accountId: string | null;
  linked: boolean;
}

export const DEMO_IDENTITIES: DemoIdentity[] = [
  { id: "koffi-google", email: "koffi.adjovi@gmail.example", description: "Compte déjà lié à un compte eGuardImmo (avec double authentification)", accountId: "koffi", linked: true },
  { id: "camille-google", email: "camille.perrin@gmail.example", description: "Compte lié à un compte eGuardImmo sans mot de passe", accountId: "camille", linked: true },
  { id: "marc-meme-email", email: "marc.chevalier@example.com", description: "Même e-mail qu’un compte existant, non lié", accountId: "marc", linked: false },
  { id: "nouveau-client", email: "nouveau.client@gmail.example", description: "Aucun compte eGuardImmo", accountId: null, linked: false },
];

export const BACKUP_CODES_INITIAL = [
  "a7k2m-9xq4d",
  "p3w8z-1ht6c",
  "r5n7v-4bj2e",
  "c9y1f-6ks3u",
  "d2g4x-8lm5a",
  "h6q3t-7wn9b",
  "j8e5k-2zp1r",
  "m4v9s-3cf7y",
];

export function backupCodesForGeneration(generation: number): string[] {
  if (generation === 0) return [...BACKUP_CODES_INITIAL];
  const alphabet = "abcdefghjkmnpqrstuvwxyz23456789";
  let seed = generation * 7919 + 17;
  const next = () => {
    seed = (seed * 48271) % 2147483647;
    return alphabet.charAt(seed % alphabet.length);
  };
  return Array.from({ length: 8 }, () => {
    const chars = Array.from({ length: 10 }, next).join("");
    return `${chars.slice(0, 5)}-${chars.slice(5)}`;
  });
}

function at(now: Date, daysAgo: number, hhmmss: string): string {
  const day = new Date(now.getTime() - daysAgo * 86_400_000).toISOString().slice(0, 10);
  return `${day}T${hhmmss}.000Z`;
}

function devices(now: Date, owner: string, withOthers: boolean): Device[] {
  const current: Device = {
    id: `${owner}-safari`,
    name: "Safari sur Mac",
    type: "navigateur",
    location: null,
    lastActivityAt: now.toISOString(),
    current: true,
  };
  if (!withOthers) return [current];
  return [
    { id: `${owner}-iphone`, name: `iPhone de ${owner}`, type: "mobile", location: "Paris", lastActivityAt: at(now, 0, "08:42:00"), current: false },
    current,
    { id: `${owner}-ipad`, name: `iPad de ${owner}`, type: "mobile", location: "Paris", lastActivityAt: at(now, 6, "18:15:00"), current: false },
  ];
}

export function seedAccounts(now: Date): DemoAccount[] {
  const noLinks = { google: null, apple: null };
  return [
    {
      id: "koffi",
      firstName: "Koffi",
      lastName: "Adjovi",
      email: "koffi.adjovi@example.com",
      emailVerified: true,
      password: DEMO_PASSWORD,
      passwordChangedAt: at(now, 90, "08:00:00"),
      twoFactor: { enabled: true, enabledAt: "2026-10-02T08:30:00.000Z", backupCodes: BACKUP_CODES_INITIAL.slice(2), backupCodesTotal: 8 },
      links: { google: { email: "koffi.adjovi@gmail.example", linkedAt: "2026-10-02T08:35:00.000Z" }, apple: null },
      profiles: [
        { id: "koffi-locataire", kind: "locataire", title: "Espace locataire", subtitle: "Studio, 8 rue Garibaldi, 69003 Lyon", summary: "Loyer de 620 € · prochain avis le 01/12/2026", badge: { label: "À jour", tone: "success" }, lastUsed: true },
      ],
      devices: devices(now, "Koffi", true),
    },
    {
      id: "marc",
      firstName: "Marc",
      lastName: "Chevalier",
      email: "marc.chevalier@example.com",
      emailVerified: true,
      password: DEMO_PASSWORD,
      passwordChangedAt: at(now, 40, "09:00:00"),
      twoFactor: { enabled: false, enabledAt: null, backupCodes: [], backupCodesTotal: 0 },
      links: noLinks,
      profiles: [
        { id: "marc-bailleur", kind: "bailleur", title: "Espace bailleur", subtitle: "Gestion Les Tilleuls · administrateur", summary: "10 locataires, 1 120 € d’impayés", badge: { label: "3 impayés", tone: "danger" }, lastUsed: true },
        { id: "marc-proprietaire", kind: "proprietaire", title: "Espace propriétaire", subtitle: "SCI Chevalier · mandat Cabinet Delmas Immobilier", summary: "2 lots, reversement en attente 651,00 €", badge: { label: "1 impayé", tone: "warning" }, lastUsed: false },
        { id: "marc-locataire", kind: "locataire", title: "Espace locataire", subtitle: "Studio, 8 rue Garibaldi, 69003 Lyon", summary: "Loyer de 620 € · prochain avis le 01/12/2026", badge: { label: "À jour", tone: "success" }, lastUsed: false },
      ],
      devices: devices(now, "Marc", true),
    },
    {
      id: "sophie",
      firstName: "Sophie",
      lastName: "Delmas",
      email: "sophie.delmas@delmas-immobilier.example",
      emailVerified: true,
      password: DEMO_PASSWORD,
      passwordChangedAt: at(now, 20, "09:00:00"),
      twoFactor: { enabled: false, enabledAt: null, backupCodes: [], backupCodesTotal: 0 },
      links: noLinks,
      profiles: [
        { id: "sophie-agence", kind: "agence", title: "Espace agence", subtitle: "Cabinet Delmas Immobilier · administrateur", summary: "42 mandats, 6 loyers en retard", badge: { label: "6 retards", tone: "warning" }, lastUsed: true },
      ],
      devices: devices(now, "Sophie", false),
    },
    {
      id: "camille",
      firstName: "Camille",
      lastName: "Perrin",
      email: "camille.perrin@example.com",
      emailVerified: true,
      password: null,
      passwordChangedAt: null,
      twoFactor: { enabled: false, enabledAt: null, backupCodes: [], backupCodesTotal: 0 },
      links: { google: { email: "camille.perrin@gmail.example", linkedAt: "2026-09-12T10:00:00.000Z" }, apple: null },
      profiles: [
        { id: "camille-voyageur", kind: "voyageur", title: "Espace voyageur", subtitle: "SeBook", summary: "Aucun séjour à venir", badge: null, lastUsed: true },
      ],
      devices: devices(now, "Camille", false),
    },
    {
      id: "sans-profil",
      firstName: "Alex",
      lastName: "Martin",
      email: "sans-profil@example.com",
      emailVerified: true,
      password: DEMO_PASSWORD,
      passwordChangedAt: at(now, 10, "09:00:00"),
      twoFactor: { enabled: false, enabledAt: null, backupCodes: [], backupCodesTotal: 0 },
      links: noLinks,
      profiles: [],
      devices: devices(now, "Alex", false),
    },
  ];
}

export interface DemoInvitation {
  kind: "locataire" | "proprietaire";
  organisation: string;
  reference: string;
  email: string;
  expiresAt: string;
}

export const DEMO_INVITATIONS: Record<string, DemoInvitation> = {
  "locataire-koffi": { kind: "locataire", organisation: "Gestion Les Tilleuls", reference: "Apt A1", email: "koffi.adjovi@example.com", expiresAt: "2026-11-20T22:59:00.000Z" },
  "proprietaire-marc": { kind: "proprietaire", organisation: "Cabinet Delmas Immobilier", reference: "M-2025-0142", email: "marc.chevalier@example.com", expiresAt: "2026-11-20T22:59:00.000Z" },
};
