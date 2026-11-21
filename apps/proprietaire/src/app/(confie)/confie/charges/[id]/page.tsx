import type { Metadata } from "next";
import { ApiOnly } from "@/owner/ApiOnly";
import { ChargeStatementScreen } from "@/owner/charges/ChargeStatementScreen";
import { WithParam } from "@/owner/WithParam";

export const metadata: Metadata = { title: "Décompte de charges" };

export default function Page({ params }: PageProps<"/confie/charges/[id]">) {
  return (
    <ApiOnly>
      <WithParam params={params} name="id">
        {(id) => <ChargeStatementScreen id={id} />}
      </WithParam>
    </ApiOnly>
  );
}
