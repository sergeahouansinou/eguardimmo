import type { Metadata } from "next";
import { EquipeRolesScreen } from "@/features/gestion/screens";
import { RolesPage } from "@/features/equipe/RolesPage";
import { dataSource } from "@/lib/env";

export const metadata: Metadata = { title: "Rôles et droits" };

export default function Page() {
  return dataSource === "api" ? <EquipeRolesScreen /> : <RolesPage />;
}
