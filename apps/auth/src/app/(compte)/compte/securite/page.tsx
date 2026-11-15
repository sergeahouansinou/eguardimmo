import type { Metadata } from "next";
import { SecuriteScreen } from "@/features/compte/SecuriteScreen";

export const metadata: Metadata = { title: "Sécurité du compte" };

export default function Page() {
  return <SecuriteScreen />;
}
