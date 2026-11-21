import type { Metadata } from "next";
import { OwnerInvitationScreen } from "@/features/invitation-proprietaire/OwnerInvitationScreen";

export const metadata: Metadata = { title: "Invitation propriétaire", referrer: "no-referrer", robots: { index: false, follow: false } };

export default function Page() {
  return <OwnerInvitationScreen urlToken={null} />;
}
