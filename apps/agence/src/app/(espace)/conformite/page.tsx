import type { Metadata } from "next";
import { ConformitePage } from "@/features/conformite/ConformitePage";

export const metadata: Metadata = { title: "Conformité" };

export default function Page() {
  return <ConformitePage />;
}
