import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { dataSource } from "@/lib/env";
import { TaxStatementScreen } from "@/owner/tax/TaxStatementScreen";
import { WithParam } from "@/owner/WithParam";

export const metadata: Metadata = { title: "Relevé fiscal" };

export default function Page({ params }: PageProps<"/confie/fiscalite/[id]">) {
  if (dataSource !== "api") notFound();
  return <WithParam params={params} name="id">{(id) => <TaxStatementScreen id={id} />}</WithParam>;
}
