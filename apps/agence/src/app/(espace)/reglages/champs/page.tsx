import type { Metadata } from "next";
import { ChampsPage } from "@/features/champs/ChampsPage";

export const metadata: Metadata = { title: "Réglages, champs personnalisés" };

export default function Page() {
  return <ChampsPage />;
}
