import type { Metadata } from "next";
import { BailFormScreen } from "@/features/locataires/screens";

export const metadata: Metadata = { title: "Nouveau bail" };

export default function Page() {
  return <BailFormScreen />;
}
