import type { Metadata } from "next";
import { ContactsScreen } from "@/features/outils/screensSuivi";

export const metadata: Metadata = { title: "Carnet de contacts" };

export default function Page() {
  return <ContactsScreen />;
}
