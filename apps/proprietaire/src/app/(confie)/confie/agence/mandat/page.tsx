import type { Metadata } from "next";
import { MandatScreen } from "@/features/confie/screens/MandatScreen";
import { dataSource } from "@/lib/env";
import { MandatesScreen } from "@/owner/mandates/MandatesScreen";

export const metadata: Metadata = { title: "Mon mandat" };

export default function Page() {
  return dataSource === "api" ? <MandatesScreen /> : <MandatScreen />;
}
