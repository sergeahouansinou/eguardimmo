import type { Metadata } from "next";
import { Suspense } from "react";
import { OwnerInvitationScreen } from "@/features/invitation-proprietaire/OwnerInvitationScreen";

export const metadata: Metadata = { title: "Invitation propriétaire", referrer: "no-referrer", robots: { index: false, follow: false } };

async function OwnerInvitation({ params }: PageProps<"/invitation-proprietaire/[jeton]">) {
  const { jeton } = await params;
  return <OwnerInvitationScreen urlToken={jeton} />;
}

export default function Page(props: PageProps<"/invitation-proprietaire/[jeton]">) {
  return (
    <Suspense fallback={null}>
      <OwnerInvitation {...props} />
    </Suspense>
  );
}
