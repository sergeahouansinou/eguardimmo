import type { Metadata } from "next";
import { ApiOnly } from "@/owner/ApiOnly";
import { PayoutScreen } from "@/owner/payout/PayoutScreen";

export const metadata: Metadata = { title: "Compte de paiement" };

export default function Page() {
  return (
    <ApiOnly>
      <PayoutScreen />
    </ApiOnly>
  );
}
