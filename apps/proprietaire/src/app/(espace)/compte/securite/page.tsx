import type { Metadata } from "next";
import { SecuriteBailleur } from "@/features/compte/SecuriteBailleur";

export const metadata: Metadata = { title: "Connexion et sécurité" };

export default function Page() {
  return <SecuriteBailleur />;
}
