import { notFound } from "next/navigation";
import { dataSource } from "@/lib/env";
import { isUuid } from "@/tenant/ids";
import { LeaseDetailScreen } from "./LeaseDetailScreen";

export async function LeaseRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (dataSource !== "api" || !isUuid(id)) notFound();
  return <LeaseDetailScreen id={id} />;
}
