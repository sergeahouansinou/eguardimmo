import type { Metadata } from "next";
import { FiscaliteScreen } from "@/features/confie/screens/FiscaliteScreen";

export const metadata: Metadata = { title: "Fiscalité" };

export default function Page() {
  return <FiscaliteScreen />;
}
