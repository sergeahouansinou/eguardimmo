import type { Metadata } from "next";
import { AccueilApiScreen } from "@/features/accueil/screens";
import { dataSource } from "@/lib/env";
import { BureauScreen } from "./BureauScreen";

export const metadata: Metadata = { title: "Accueil" };

export default function Page() {
  if (dataSource === "api") return <AccueilApiScreen />;
  return <BureauScreen />;
}
