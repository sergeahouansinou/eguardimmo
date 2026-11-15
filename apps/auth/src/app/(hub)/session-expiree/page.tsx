import type { Metadata } from "next";
import { SessionExpireeScreen } from "@/features/connexion/StatusScreens";

export const metadata: Metadata = { title: "Session expirée" };

export default function Page() {
  return <SessionExpireeScreen />;
}
