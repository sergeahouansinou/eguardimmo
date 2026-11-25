import type { Metadata } from "next";
import AccountPage from "@/components/roost/compte/AccountPage";

export const metadata: Metadata = { title: "Mon compte", robots: { index: false, follow: false } };

export default function ComptePage() {
  return <AccountPage />;
}
