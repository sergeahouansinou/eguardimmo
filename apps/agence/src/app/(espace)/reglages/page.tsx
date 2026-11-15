import type { Metadata } from "next";
import { IdentityPage } from "@/features/reglages/IdentityPage";

export const metadata: Metadata = { title: "Réglages, identité de l’agence" };

export default function Page() {
  return <IdentityPage />;
}
