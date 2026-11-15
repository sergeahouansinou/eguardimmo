import type { Metadata } from "next";
import { MandatFinScreen } from "@/features/confie/screens/MandatFinScreen";

export const metadata: Metadata = { title: "Demande de fin de mandat" };

export default function Page() {
  return <MandatFinScreen />;
}
