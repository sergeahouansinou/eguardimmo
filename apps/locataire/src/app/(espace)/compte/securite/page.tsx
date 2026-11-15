import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ScreenState";
import { SecuriteScreen } from "@/features/compte/SecuriteScreen";

export const metadata: Metadata = { title: "Sécurité" };

export default function Page() {
  return (
    <Suspense fallback={<Skeleton />}>
      <SecuriteScreen />
    </Suspense>
  );
}
