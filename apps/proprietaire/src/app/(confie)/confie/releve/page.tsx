import type { Metadata } from "next";
import { ReleveScreen } from "@/features/confie/screens/ReleveScreen";
import { dataSource } from "@/lib/env";
import { StatementScreen } from "@/owner/statement/StatementScreen";

export const metadata: Metadata = { title: "Relevé de compte" };

export default function Page() {
  return dataSource === "api" ? <StatementScreen /> : <ReleveScreen />;
}
