import type { Metadata } from "next";
import { CandidatInviteScreen } from "@/features/gestion/screens";
import { ApiOnly } from "@/features/gestion/ApiOnly";

export const metadata: Metadata = { title: "Inviter un candidat" };

export default function Page() {
  return <ApiOnly><CandidatInviteScreen /></ApiOnly>;
}
