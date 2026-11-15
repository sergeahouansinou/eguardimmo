import type { Metadata } from "next";
import { SignatureNewScreen } from "@/features/locataires/screens";

export const metadata: Metadata = { title: "Nouvelle demande de signature" };

export default function Page() {
  return <SignatureNewScreen />;
}
