import { SecuriteCommunePage } from "@eguardimmo/gestion";
import type { Metadata } from "next";
import { SecurityPage } from "@/features/compte/SecurityPage";
import { dataSource } from "@/lib/env";

export const metadata: Metadata = { title: "Sécurité" };

export default function Page() {
  return dataSource === "api" ? <SecuriteCommunePage /> : <SecurityPage />;
}
