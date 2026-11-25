import type { Metadata } from "next";
import { AccountsPage } from "@/features/comptabilite/AccountsPage";

export const metadata: Metadata = { title: "Comptabilité" };

export default function Page() {
  return <AccountsPage />;
}
