import type { Metadata } from "next";
import { EmailsSecuriteScreen } from "@/features/emails/EmailsSecuriteScreen";

export const metadata: Metadata = { title: "E-mails de sécurité" };

export default function Page() {
  return <EmailsSecuriteScreen />;
}
