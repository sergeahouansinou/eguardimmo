import type { Metadata } from "next";
import { ChargesExercicesApiScreen } from "@/features/finances/apiScreens";
import { RegularisationScreen } from "@/features/finances/screens";
import { dataSource } from "@/lib/env";

export const metadata: Metadata = { title: "Régularisation des charges" };

export default function Page() {
  return dataSource === "api" ? <ChargesExercicesApiScreen /> : <RegularisationScreen />;
}
