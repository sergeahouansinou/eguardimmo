import type { Metadata } from "next";
import { AgenceScreen } from "@/features/confie/screens/AgenceScreen";
import { dataSource } from "@/lib/env";
import { AccessesScreen } from "@/owner/screens/AccessesScreen";

export const metadata: Metadata = { title: "Mon agence" };

export default function Page() {
  return dataSource === "api" ? <AccessesScreen /> : <AgenceScreen />;
}
