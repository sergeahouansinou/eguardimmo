import type { Metadata } from "next";
import { SecurityPage } from "@/features/compte/SecurityPage";

export const metadata: Metadata = { title: "Sécurité" };

export default function Page() {
  return <SecurityPage />;
}
