import { notFound } from "next/navigation";
import { dataSource } from "@/lib/env";
import { isUuid } from "@/tenant/ids";
import { ApiEtatDetailScreen } from "./ApiEtatDetailScreen";
import { EtatDetailScreen } from "./EtatDetailScreen";

export async function EtatRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (dataSource === "api") {
    if (!isUuid(id)) notFound();
    return <ApiEtatDetailScreen id={id} />;
  }
  return <EtatDetailScreen inspectionId={id} />;
}
