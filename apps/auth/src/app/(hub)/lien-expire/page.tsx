import type { Metadata } from "next";
import { LienExpireScreen } from "@/features/connexion/StatusScreens";

export const metadata: Metadata = { title: "Lien expiré" };

export default function Page() {
  return <LienExpireScreen />;
}
