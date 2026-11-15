import { Building2, House, KeyRound, Plane, UserRound } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Profile } from "@/features/auth/schemas";

export const PROFILE_ICONS: Record<Profile["kind"], LucideIcon> = {
  agence: Building2,
  bailleur: House,
  proprietaire: KeyRound,
  locataire: UserRound,
  voyageur: Plane,
};
