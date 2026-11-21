import { SecuriteApiPage, SecuriteCommunePage } from "@eguardimmo/gestion";
import type { Metadata } from "next";
import { dataSource } from "@/lib/env";

export const metadata: Metadata = { title: "Connexion et sécurité" };

export default function Page() {
  return dataSource === "api" ? <SecuriteApiPage /> : <SecuriteCommunePage />;
}
