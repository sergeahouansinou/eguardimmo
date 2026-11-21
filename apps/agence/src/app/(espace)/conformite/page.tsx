import type { Metadata } from "next";
import { ConformitePage } from "@/features/conformite/ConformitePage";
import { ConformiteApiScreen } from "@/features/gestion/screens";
import { dataSource } from "@/lib/env";

export const metadata: Metadata = { title: "Conformité" };

export default function Page() {
  return dataSource === "api" ? <ConformiteApiScreen /> : <ConformitePage />;
}
