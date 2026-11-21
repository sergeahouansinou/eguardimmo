import type { Metadata } from "next";
import { ApiOnly } from "@/owner/ApiOnly";
import { LeaseScreen } from "@/owner/leases/LeaseScreen";
import { WithParam } from "@/owner/WithParam";

export const metadata: Metadata = { title: "Bail" };

export default function Page({ params }: PageProps<"/confie/baux/[id]">) {
  return (
    <ApiOnly>
      <WithParam params={params} name="id">
        {(id) => <LeaseScreen id={id} />}
      </WithParam>
    </ApiOnly>
  );
}
