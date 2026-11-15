import type { Metadata } from "next";
import { LocatairesScreen } from "@/features/locataires/screens";

export const metadata: Metadata = { title: "Locataires" };

export default function Page() {
  return <LocatairesScreen />;
}
