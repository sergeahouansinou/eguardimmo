import type { Metadata } from "next";
import { Suspense } from "react";
import { InvitationScreen } from "@/features/invitation/InvitationScreen";

export const metadata: Metadata = { title: "Activer mon espace" };

async function Invitation({ params }: PageProps<"/invitation/[jeton]">) {
  const { jeton } = await params;
  return <InvitationScreen token={jeton} />;
}

export default function Page(props: PageProps<"/invitation/[jeton]">) {
  return (
    <Suspense fallback={null}>
      <Invitation {...props} />
    </Suspense>
  );
}
