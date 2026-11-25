import type { Metadata } from "next";
import { EntriesPage } from "@/features/comptabilite/EntriesPage";

export const metadata: Metadata = { title: "Écritures comptables" };

export default function Page() {
  return <EntriesPage />;
}
