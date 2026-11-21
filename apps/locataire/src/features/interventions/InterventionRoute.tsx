import { notFound } from "next/navigation";
import { dataSource } from "@/lib/env";
import { isUuid } from "@/tenant/ids";
import { ApiDetailScreen } from "./ApiDetailScreen";

export async function InterventionRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (dataSource !== "api" || !isUuid(id)) notFound();
  return <ApiDetailScreen id={id} />;
}
