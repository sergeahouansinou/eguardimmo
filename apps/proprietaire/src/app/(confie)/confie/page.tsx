import type { Metadata } from "next";
import { AccueilScreen } from "@/features/confie/screens/AccueilScreen";
import { dataSource } from "@/lib/env";
import { HomeScreen } from "@/owner/screens/HomeScreen";

export const metadata: Metadata = { title: "Accueil" };

export default function Page() {
  return dataSource === "api" ? <HomeScreen /> : <AccueilScreen />;
}
