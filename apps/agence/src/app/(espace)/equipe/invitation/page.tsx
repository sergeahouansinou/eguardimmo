import type { Metadata } from "next";
import { EquipeInviteScreen } from "@/features/gestion/screens";
import { InvitationPage } from "@/features/equipe/InvitationPage";
import { dataSource } from "@/lib/env";

export const metadata: Metadata = { title: "Inviter un collaborateur" };

export default function Page() {
  return dataSource === "api" ? <EquipeInviteScreen /> : <InvitationPage />;
}
