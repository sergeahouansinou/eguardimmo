import type { Metadata } from "next";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/ui/PageSkeleton";
import { InvitationPage } from "@/features/portefeuille/locataires/InvitationPage";

export const metadata: Metadata = { title: "Inviter un locataire" };

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <InvitationPage />
    </Suspense>
  );
}
