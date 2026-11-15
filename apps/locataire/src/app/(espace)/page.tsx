import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ScreenState";
import { HomeScreen } from "@/features/accueil/HomeScreen";

export const metadata: Metadata = { title: "Accueil" };

export default function Page() {
  return (
    <Suspense fallback={<Skeleton />}>
      <HomeScreen />
    </Suspense>
  );
}
