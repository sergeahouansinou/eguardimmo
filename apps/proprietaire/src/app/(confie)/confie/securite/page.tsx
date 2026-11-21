import type { Metadata } from "next";
import { SecuriteScreen } from "@/features/confie/screens/SecuriteScreen";
import { dataSource } from "@/lib/env";
import { ApiSecuriteScreen } from "@/owner/account/AccountScreens";

export const metadata: Metadata = { title: "Sécurité" };

export default function Page() {
  return dataSource === "api" ? <ApiSecuriteScreen /> : <SecuriteScreen />;
}
