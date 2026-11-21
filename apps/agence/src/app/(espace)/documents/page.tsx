import type { Metadata } from "next";
import { DocumentsPage } from "@/features/documents/DocumentsPage";
import { DocumentsLibraryScreen } from "@/features/documents/LibraryScreens";
import { dataSource } from "@/lib/env";

export const metadata: Metadata = { title: "Documents" };

export default function Page() {
  return dataSource === "api" ? <DocumentsLibraryScreen /> : <DocumentsPage />;
}
