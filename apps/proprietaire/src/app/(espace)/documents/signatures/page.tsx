import type { Metadata } from "next";
import { SignaturesScreen } from "@/features/locataires/screens";

export const metadata: Metadata = { title: "Signatures" };

export default function Page() {
  return <SignaturesScreen />;
}
