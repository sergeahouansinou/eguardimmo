import type { Metadata } from "next";
import { CourriersScreen } from "@/features/locataires/screens";

export const metadata: Metadata = { title: "Courriers" };

export default function Page() {
  return <CourriersScreen />;
}
