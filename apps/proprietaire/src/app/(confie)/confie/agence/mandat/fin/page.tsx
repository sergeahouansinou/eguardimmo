import type { Metadata } from "next";
import { MandatFinScreen } from "@/features/confie/screens/MandatFinScreen";
import { dataSource } from "@/lib/env";
import { MandateEndScreen } from "@/owner/mandates/MandateEndScreen";

export const metadata: Metadata = { title: "Demande de fin de mandat" };

export default function Page() {
  return dataSource === "api" ? <MandateEndScreen /> : <MandatFinScreen />;
}
