import type { Metadata } from "next";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/ui/PageSkeleton";
import { InvitationLocataireScreen } from "@/features/gestion/screens";
import { InvitationPage } from "@/features/portefeuille/locataires/InvitationPage";
import { dataSource } from "@/lib/env";

export const metadata: Metadata = { title: "Inviter un locataire" };

export default function Page() {
  if (dataSource === "api") return <InvitationLocataireScreen />;
  return (
    <Suspense fallback={<PageSkeleton />}>
      <InvitationPage />
    </Suspense>
  );
}
