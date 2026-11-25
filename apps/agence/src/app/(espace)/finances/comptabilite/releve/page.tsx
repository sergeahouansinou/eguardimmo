import type { Metadata } from "next";
import { StatementPage } from "@/features/comptabilite/StatementPage";

export const metadata: Metadata = { title: "Relevé de bail" };

export default function Page() {
  return <StatementPage />;
}
