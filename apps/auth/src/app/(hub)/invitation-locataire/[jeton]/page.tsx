import type { Metadata } from "next";
import { Suspense } from "react";
import { TenantInvitationScreen } from "@/features/invitation-locataire/TenantInvitationScreen";

export const metadata: Metadata = { title: "Invitation locataire", referrer: "no-referrer" };

async function TenantInvitation({ params }: PageProps<"/invitation-locataire/[jeton]">) {
  const { jeton } = await params;
  return <TenantInvitationScreen urlToken={jeton} />;
}

export default function Page(props: PageProps<"/invitation-locataire/[jeton]">) {
  return (
    <Suspense fallback={null}>
      <TenantInvitation {...props} />
    </Suspense>
  );
}
