import type { Avis, Invitation } from "./schemas";

export const INVITATION_BASE_URL = "https://locataire.eguardimmo.example/invitation";

export const demoInvitations: Invitation[] = [
  {
    id: "inv-0001",
    email: "ines.laurent@example.com",
    name: "Inès Laurent",
    bailId: "b-2026-016",
    message: "Bonjour, activez votre espace locataire pour suivre vos loyers et télécharger vos quittances.",
    link: `${INVITATION_BASE_URL}/ines-laurent-k3f9a2`,
    sentIso: "2026-11-06",
    expiresIso: "2026-11-20",
    status: "envoyee",
    reminders: 0,
  },
  {
    id: "inv-0002",
    email: "louis.petit@example.com",
    name: "Louis Petit",
    bailId: "b-2026-004",
    message: "Bonjour, activez votre espace locataire pour suivre votre compte et régler votre loyer.",
    link: `${INVITATION_BASE_URL}/louis-petit-q8d1m7`,
    sentIso: "2026-10-20",
    expiresIso: "2026-11-03",
    status: "envoyee",
    reminders: 1,
  },
  {
    id: "inv-0003",
    email: "thomas.girard@example.com",
    name: "Thomas Girard",
    bailId: "b-2024-018",
    message: "Bonjour, activez votre espace locataire eGuardImmo.",
    link: `${INVITATION_BASE_URL}/thomas-girard-w2n6c4`,
    sentIso: "2024-09-01",
    expiresIso: "2024-09-15",
    status: "acceptee",
    reminders: 0,
  },
];

const ISSUED_BAIL_IDS = [
  "b-2024-018",
  "b-2026-007",
  "b-2025-009",
  "b-2026-004",
  "b-2025-021",
  "b-2025-013",
  "b-2026-016",
  "b-2025-005",
  "b-2024-029",
  "b-2026-010",
  "b-2023-017",
  "b-2024-031",
  "b-2024-003",
  "b-2026-001",
];

const DECEMBER_BAIL_IDS = ["b-2024-018", "b-2025-009", "b-2025-005"];

export function avisId(bailId: string, month: string): string {
  return `${bailId}@${month}`;
}

export const demoAvis: Avis[] = [
  ...ISSUED_BAIL_IDS.map((bailId) => ({ id: avisId(bailId, "2026-11"), bailId, month: "2026-11", sentIso: "2026-10-25" })),
  ...DECEMBER_BAIL_IDS.map((bailId) => ({ id: avisId(bailId, "2026-12"), bailId, month: "2026-12", sentIso: "2026-11-10" })),
];
