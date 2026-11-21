import { InboxPage } from "@eguardimmo/messagerie";
import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ScreenState";
import { ApiInboxScreen } from "@/features/conversations/ApiMessageScreens";
import { dataSource } from "@/lib/env";

export const metadata: Metadata = { title: "Messages" };

export default function Page() {
  return <Suspense fallback={<Skeleton />}>{dataSource === "api" ? <ApiInboxScreen /> : <InboxPage />}</Suspense>;
}
