import type { Metadata } from "next";
import { FacturesScreen } from "@/features/finances/screens";

export const metadata: Metadata = { title: "Factures" };

export default function Page() {
  return <FacturesScreen />;
}
