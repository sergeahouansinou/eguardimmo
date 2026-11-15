import type { Metadata } from "next";
import { ContactFormScreen } from "@/features/outils/screensSuivi";

export const metadata: Metadata = { title: "Nouveau contact" };

export default function Page() {
  return <ContactFormScreen />;
}
