import type { Metadata } from "next";
import { EvenementFormScreen } from "@/features/outils/screensSuivi";

export const metadata: Metadata = { title: "Nouvel événement" };

export default function Page() {
  return <EvenementFormScreen />;
}
