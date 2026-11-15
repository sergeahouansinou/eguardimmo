import type { Metadata } from "next";
import { ComptesLiesScreen } from "@/features/compte/ComptesLiesScreens";

export const metadata: Metadata = { title: "Comptes liés" };

export default function Page() {
  return <ComptesLiesScreen />;
}
