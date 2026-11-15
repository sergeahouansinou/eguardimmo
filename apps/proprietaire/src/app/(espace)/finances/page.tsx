import type { Metadata } from "next";
import { FinancesScreen } from "@/features/finances/screens";

export const metadata: Metadata = { title: "Finances" };

export default function Page() {
  return <FinancesScreen />;
}
