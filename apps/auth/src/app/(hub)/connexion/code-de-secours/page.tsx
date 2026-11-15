import type { Metadata } from "next";
import { BackupCodeScreen } from "@/features/connexion/TwoFactorScreens";

export const metadata: Metadata = { title: "Code de secours" };

export default function Page() {
  return <BackupCodeScreen />;
}
