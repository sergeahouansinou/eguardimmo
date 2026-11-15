import type { Metadata } from "next";
import { DocumentAddPage } from "@/features/documents/DocumentAddPage";

export const metadata: Metadata = { title: "Ajouter un document" };

export default function Page() {
  return <DocumentAddPage />;
}
