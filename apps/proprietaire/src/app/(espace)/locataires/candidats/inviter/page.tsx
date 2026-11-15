import type { Metadata } from "next";
import { CandidatInviteScreen } from "@/features/locataires/screens";

export const metadata: Metadata = { title: "Inviter un candidat" };

export default function Page() {
  return <CandidatInviteScreen />;
}
