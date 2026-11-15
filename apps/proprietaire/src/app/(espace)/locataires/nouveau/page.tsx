import type { Metadata } from "next";
import { LocataireFormScreen } from "@/features/locataires/screens";

export const metadata: Metadata = { title: "Nouveau locataire" };

export default function Page() {
  return <LocataireFormScreen />;
}
