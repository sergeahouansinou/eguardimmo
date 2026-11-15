import type { Metadata } from "next";
import { SecuriteScreen } from "@/features/confie/screens/SecuriteScreen";

export const metadata: Metadata = { title: "Sécurité" };

export default function Page() {
  return <SecuriteScreen />;
}
