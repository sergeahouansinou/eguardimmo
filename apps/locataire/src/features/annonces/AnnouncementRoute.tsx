import { AnnouncementDetailPage, AnnouncementsListPage } from "@eguardimmo/messagerie";
import { notFound } from "next/navigation";
import { dataSource } from "@/lib/env";
import { isUuid } from "@/tenant/ids";

export async function AnnouncementRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (dataSource !== "api" || !isUuid(id)) notFound();
  return <AnnouncementDetailPage announcementId={id} />;
}

export function AnnouncementsRoute() {
  if (dataSource !== "api") notFound();
  return <AnnouncementsListPage />;
}
