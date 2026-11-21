import { CURRENT_USER } from "@/features/shared/directory";
import { DEMO_NOW } from "@/features/shared/dates";
import type { PortfolioMode } from "./schemas";
import type { RoleId } from "./rights";

export interface MemberRecord {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: RoleId;
  portfolioMode: PortfolioMode;
  mandantIds: readonly string[];
  twoFactor: "enabled" | "disabled" | "at_acceptance";
  status: "active" | "invited" | "inactive";
  lastLogin: string | null;
  online: boolean;
  invitedAt: string | null;
}

export const INITIAL_MEMBERS: readonly MemberRecord[] = [
  {
    id: CURRENT_USER.id,
    firstName: CURRENT_USER.firstName,
    lastName: CURRENT_USER.lastName,
    email: CURRENT_USER.email,
    role: "titulaire",
    portfolioMode: "all",
    mandantIds: [],
    twoFactor: "enabled",
    status: "active",
    lastLogin: DEMO_NOW,
    online: true,
    invitedAt: null,
  },
  {
    id: "julien-marchand",
    firstName: "Julien",
    lastName: "Marchand",
    email: "julien.marchand@example.com",
    role: "gestionnaire",
    portfolioMode: "chosen",
    mandantIds: ["marc-chevalier", "famille-bernard", "helene-roussel"],
    twoFactor: "enabled",
    status: "active",
    lastLogin: "2026-11-13T08:12",
    online: false,
    invitedAt: null,
  },
  {
    id: "camille-perrin",
    firstName: "Camille",
    lastName: "Perrin",
    email: "camille.perrin@example.com",
    role: "comptable",
    portfolioMode: "all",
    mandantIds: [],
    twoFactor: "enabled",
    status: "active",
    lastLogin: "2026-11-12T17:40",
    online: false,
    invitedAt: null,
  },
  {
    id: "lea-fontaine",
    firstName: "Léa",
    lastName: "Fontaine",
    email: "lea.fontaine@example.com",
    role: "gestionnaire",
    portfolioMode: "all",
    mandantIds: [],
    twoFactor: "disabled",
    status: "active",
    lastLogin: "2026-11-10T09:05",
    online: false,
    invitedAt: null,
  },
  {
    id: "mathieu-garnier",
    firstName: "Mathieu",
    lastName: "Garnier",
    email: "mathieu.garnier@example.com",
    role: "gestionnaire",
    portfolioMode: "chosen",
    mandantIds: ["sci-les-acacias", "paul-lemoine", "nadia-benali"],
    twoFactor: "at_acceptance",
    status: "invited",
    lastLogin: null,
    online: false,
    invitedAt: "2026-11-12T09:30",
  },
];
