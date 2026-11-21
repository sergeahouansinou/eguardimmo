import type { Metadata } from "next";
import { DocumentsScreen } from "@/features/confie/screens/DocumentsScreen";
import { dataSource } from "@/lib/env";
import { DocumentsScreen as ApiDocumentsScreen } from "@/owner/documents/DocumentsScreen";

export const metadata: Metadata = { title: "Documents" };

export default function Page() {
  return dataSource === "api" ? <ApiDocumentsScreen /> : <DocumentsScreen />;
}
