import type { Metadata } from "next";
import { DocumentsConformiteScreen } from "@/features/conformite/screens";
import { DocumentsScreen } from "@/features/outils/screensSuivi";
import { dataSource } from "@/lib/env";

export const metadata: Metadata = { title: "Documents" };

export default function Page() {
  return dataSource === "api" ? <DocumentsConformiteScreen /> : <DocumentsScreen />;
}
