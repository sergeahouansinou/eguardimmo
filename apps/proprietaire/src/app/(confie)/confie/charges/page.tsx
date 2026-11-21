import type { Metadata } from "next";
import { ApiOnly } from "@/owner/ApiOnly";
import { ChargeStatementsScreen } from "@/owner/charges/ChargeStatementsScreen";

export const metadata: Metadata = { title: "Décomptes de charges" };

export default function Page() {
  return (
    <ApiOnly>
      <ChargeStatementsScreen />
    </ApiOnly>
  );
}
