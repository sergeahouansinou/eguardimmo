import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ScreenState";
import { DocumentsScreen } from "@/features/documents/DocumentsScreen";

export const metadata: Metadata = { title: "Documents" };

export default function Page() {
  return (
    <Suspense fallback={<Skeleton />}>
      <DocumentsScreen />
    </Suspense>
  );
}
