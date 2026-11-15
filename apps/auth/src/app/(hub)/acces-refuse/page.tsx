import type { Metadata } from "next";
import { AccesRefuseScreen } from "@/features/espaces/AccesRefuseScreen";

export const metadata: Metadata = { title: "Accès refusé" };

export default function Page() {
  return <AccesRefuseScreen />;
}
