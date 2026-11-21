import type { Metadata } from "next";
import { PretsApiScreen } from "@/features/finances/apiScreens";
import { PretsScreen } from "@/features/finances/screens";
import { dataSource } from "@/lib/env";

export const metadata: Metadata = { title: "Prêts immobiliers" };

export default function Page() {
  return dataSource === "api" ? <PretsApiScreen /> : <PretsScreen />;
}
