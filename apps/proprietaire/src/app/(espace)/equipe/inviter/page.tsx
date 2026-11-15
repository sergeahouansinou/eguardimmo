import type { Metadata } from "next";
import { EquipeInviteScreen } from "@/features/outils/screensCompte";

export const metadata: Metadata = { title: "Inviter un membre" };

export default function Page() {
  return <EquipeInviteScreen />;
}
