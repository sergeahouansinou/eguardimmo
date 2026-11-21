import type { Metadata } from "next";
import { TenantInvitationScreen } from "@/features/invitation-locataire/TenantInvitationScreen";

export const metadata: Metadata = { title: "Invitation locataire", referrer: "no-referrer" };

export default function Page() {
  return <TenantInvitationScreen urlToken={null} />;
}
