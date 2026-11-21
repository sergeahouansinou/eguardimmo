import { ExternalThreadPage } from "@eguardimmo/messagerie";
import { notFound } from "next/navigation";
import { dataSource } from "@/lib/env";
import { isUuid } from "@/tenant/ids";

export async function MessageRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (dataSource !== "api" || !isUuid(id)) notFound();
  return <ExternalThreadPage threadId={id} />;
}
