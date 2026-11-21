import type { Metadata } from "next";
import { IdentiteLegaleScreen } from "@/features/gestion/screens";
import { IdentityPage } from "@/features/reglages/IdentityPage";
import { dataSource } from "@/lib/env";

export const metadata: Metadata = { title: "Réglages, identité de l’agence" };

export default function Page() {
  return dataSource === "api" ? <IdentiteLegaleScreen /> : <IdentityPage />;
}
