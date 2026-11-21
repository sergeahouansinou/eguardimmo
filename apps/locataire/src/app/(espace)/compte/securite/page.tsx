import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ScreenState";
import { ApiSecuriteScreen } from "@/features/compte/ApiAccountScreens";
import { SecuriteScreen } from "@/features/compte/SecuriteScreen";
import { dataSource } from "@/lib/env";

export const metadata: Metadata = { title: "Sécurité" };

export default function Page() {
  return (
    <Suspense fallback={<Skeleton />}>
      {dataSource === "api" ? <ApiSecuriteScreen /> : <SecuriteScreen />}
    </Suspense>
  );
}
