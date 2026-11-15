import { HelpPage } from "@eguardimmo/messagerie";
import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ScreenState";

export const metadata: Metadata = { title: "Aide" };

export default function Page() {
  return (
    <Suspense fallback={<Skeleton />}>
      <HelpPage />
    </Suspense>
  );
}
