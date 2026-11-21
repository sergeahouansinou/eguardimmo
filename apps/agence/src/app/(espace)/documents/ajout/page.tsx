import type { Metadata } from "next";
import { DocumentAddPage } from "@/features/documents/DocumentAddPage";
import { DocumentsLibraryAddScreen } from "@/features/documents/LibraryScreens";
import { dataSource } from "@/lib/env";

export const metadata: Metadata = { title: "Ajouter un document" };

export default function Page() {
  return dataSource === "api" ? <DocumentsLibraryAddScreen /> : <DocumentAddPage />;
}
