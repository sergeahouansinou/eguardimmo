import type { Metadata } from "next";
import { EquipePage } from "@/features/equipe/EquipePage";

export const metadata: Metadata = { title: "Équipe" };

export default function Page() {
  return <EquipePage />;
}
