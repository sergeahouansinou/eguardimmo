import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ScreenState";
import { DocumentsScreen } from "@/features/documents/DocumentsScreen";
import { ApiDocumentsScreen } from "@/features/documents/ApiDocumentsScreen";
import { dataSource } from "@/lib/env";

export const metadata: Metadata = { title: "Documents" };

export default function Page() {
  return (
    <Suspense fallback={<Skeleton />}>
      {dataSource === "api" ? <ApiDocumentsScreen /> : <DocumentsScreen />}
    </Suspense>
  );
}
