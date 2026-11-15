import type { Metadata } from "next";
import { InvitationPage } from "@/features/equipe/InvitationPage";

export const metadata: Metadata = { title: "Inviter un collaborateur" };

export default function Page() {
  return <InvitationPage />;
}
