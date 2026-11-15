import type { Metadata } from "next";
import { MandatScreen } from "@/features/confie/screens/MandatScreen";

export const metadata: Metadata = { title: "Mon mandat" };

export default function Page() {
  return <MandatScreen />;
}
