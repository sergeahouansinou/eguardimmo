import { NewMessagePage } from "@eguardimmo/messagerie";
import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ScreenState";

export const metadata: Metadata = { title: "Nouveau message" };

export default function Page() {
  return (
    <Suspense fallback={<Skeleton />}>
      <NewMessagePage />
    </Suspense>
  );
}
