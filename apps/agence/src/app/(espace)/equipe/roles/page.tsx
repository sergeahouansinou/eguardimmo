import type { Metadata } from "next";
import { RolesPage } from "@/features/equipe/RolesPage";

export const metadata: Metadata = { title: "Rôles et droits" };

export default function Page() {
  return <RolesPage />;
}
