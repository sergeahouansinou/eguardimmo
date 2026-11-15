import type { Metadata } from "next";
import { MotDePasseEnvoyeScreen } from "@/features/mot-de-passe/MotDePasseScreens";

export const metadata: Metadata = { title: "Consultez vos e-mails" };

export default function Page() {
  return <MotDePasseEnvoyeScreen />;
}
