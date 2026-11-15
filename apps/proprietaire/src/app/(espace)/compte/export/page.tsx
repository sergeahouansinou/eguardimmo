import type { Metadata } from "next";
import { ExportScreen } from "@/features/outils/screensCompte";

export const metadata: Metadata = { title: "Exporter mes données" };

export default function Page() {
  return <ExportScreen />;
}
