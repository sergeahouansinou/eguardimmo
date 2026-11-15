import type { Metadata } from "next";
import { ImportBancaireScreen } from "@/features/finances/screens";

export const metadata: Metadata = { title: "Import bancaire" };

export default function Page() {
  return <ImportBancaireScreen />;
}
