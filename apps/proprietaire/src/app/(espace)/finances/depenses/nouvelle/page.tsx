import type { Metadata } from "next";
import { DepenseFormApiScreen } from "@/features/finances/apiScreens";
import { DepenseScreen } from "@/features/finances/screens";
import { dataSource } from "@/lib/env";

export const metadata: Metadata = { title: "Ajouter une dépense" };

export default function Page() {
  return dataSource === "api" ? <DepenseFormApiScreen /> : <DepenseScreen />;
}
