import type { Metadata } from "next";
import { EvenementFormApiScreen } from "@/features/outils/screensOrg";
import { EvenementFormScreen } from "@/features/outils/screensSuivi";
import { dataSource } from "@/lib/env";

export const metadata: Metadata = { title: "Nouvel événement" };

export default function Page() {
  return dataSource === "api" ? <EvenementFormApiScreen /> : <EvenementFormScreen />;
}
