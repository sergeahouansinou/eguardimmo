import { CompteApiPage } from "@eguardimmo/gestion";
import type { Metadata } from "next";
import { CompteScreen } from "@/features/outils/screensCompte";
import { dataSource } from "@/lib/env";

export const metadata: Metadata = { title: "Mon compte" };

export default function Page() {
  return dataSource === "api" ? <CompteApiPage /> : <CompteScreen />;
}
