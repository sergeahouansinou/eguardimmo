import { notFound } from "next/navigation";
import { dataSource } from "@/lib/env";
import { isUuid } from "@/tenant/ids";
import { ChargeStatementDetailScreen } from "./ChargeStatementDetailScreen";

export async function ChargeRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (dataSource !== "api" || !isUuid(id)) notFound();
  return <ChargeStatementDetailScreen id={id} />;
}
