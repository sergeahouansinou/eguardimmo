import type { Metadata } from "next";
import { EquipeScreen } from "@/features/gestion/screens";
import { EquipePage } from "@/features/equipe/EquipePage";
import { dataSource } from "@/lib/env";

export const metadata: Metadata = { title: "Équipe" };

export default function Page() {
  return dataSource === "api" ? <EquipeScreen /> : <EquipePage />;
}
