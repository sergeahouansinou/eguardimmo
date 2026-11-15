import type { Metadata } from "next";
import { TachesScreen } from "@/features/outils/screensSuivi";

export const metadata: Metadata = { title: "Tâches et rappels" };

export default function Page() {
  return <TachesScreen />;
}
