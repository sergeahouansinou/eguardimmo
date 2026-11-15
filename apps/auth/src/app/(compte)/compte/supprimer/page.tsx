import type { Metadata } from "next";
import { SuppressionScreen } from "@/features/compte/SuppressionScreen";

export const metadata: Metadata = { title: "Supprimer mon compte" };

export default function Page() {
  return <SuppressionScreen />;
}
