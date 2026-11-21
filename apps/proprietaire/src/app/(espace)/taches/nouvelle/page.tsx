import type { Metadata } from "next";
import { TacheFormApiScreen } from "@/features/outils/screensOrg";
import { TacheFormScreen } from "@/features/outils/screensSuivi";
import { dataSource } from "@/lib/env";

export const metadata: Metadata = { title: "Nouvelle tâche" };

export default function Page() {
  return dataSource === "api" ? <TacheFormApiScreen /> : <TacheFormScreen />;
}
