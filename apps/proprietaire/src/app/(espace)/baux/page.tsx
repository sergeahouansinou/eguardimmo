import type { Metadata } from "next";
import { BauxScreen } from "@/features/locataires/screens";

export const metadata: Metadata = { title: "Baux" };

export default function Page() {
  return <BauxScreen />;
}
