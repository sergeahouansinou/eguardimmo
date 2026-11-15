import type { Metadata } from "next";
import { DocumentImportScreen } from "@/features/outils/screensSuivi";

export const metadata: Metadata = { title: "Importer des documents" };

export default function Page() {
  return <DocumentImportScreen />;
}
