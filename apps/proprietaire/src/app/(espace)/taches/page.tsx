import type { Metadata } from "next";
import { TachesApiScreen } from "@/features/outils/screensOrg";
import { TachesScreen } from "@/features/outils/screensSuivi";
import { dataSource } from "@/lib/env";

export const metadata: Metadata = { title: "Tâches et rappels" };

export default function Page() {
  return dataSource === "api" ? <TachesApiScreen /> : <TachesScreen />;
}
