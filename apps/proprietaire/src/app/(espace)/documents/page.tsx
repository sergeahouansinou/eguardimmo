import type { Metadata } from "next";
import { DocumentsScreen } from "@/features/outils/screensSuivi";

export const metadata: Metadata = { title: "Documents" };

export default function Page() {
  return <DocumentsScreen />;
}
