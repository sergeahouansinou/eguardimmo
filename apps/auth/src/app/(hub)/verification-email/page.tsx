import type { Metadata } from "next";
import { VerificationEmailScreen } from "@/features/inscription/VerificationEmailScreens";

export const metadata: Metadata = { title: "Vérifiez vos e-mails" };

export default function Page() {
  return <VerificationEmailScreen />;
}
