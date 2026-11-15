import type { Metadata } from "next";
import { SubscriptionPage } from "@/features/compte/SubscriptionPage";

export const metadata: Metadata = { title: "Abonnement" };

export default function Page() {
  return <SubscriptionPage />;
}
