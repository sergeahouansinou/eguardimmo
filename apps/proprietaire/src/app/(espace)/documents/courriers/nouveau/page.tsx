import type { Metadata } from "next";
import { CourrierFormScreen } from "@/features/locataires/screens";

export const metadata: Metadata = { title: "Nouveau courrier" };

export default function Page() {
  return <CourrierFormScreen />;
}
