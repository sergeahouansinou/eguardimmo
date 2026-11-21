import { InboxPage } from "@eguardimmo/messagerie";
import type { Metadata } from "next";
import { Suspense } from "react";
import { ApiMessagesHome } from "@/features/messagerie/MessagesScreens";
import { dataSource } from "@/lib/env";

export const metadata: Metadata = { title: "Messages" };

export default function Page() {
  return (
    <Suspense fallback={<div aria-hidden="true" className="h-7 w-48 animate-pulse rounded-sm bg-muted" />}>
      {dataSource === "api" ? <ApiMessagesHome /> : <InboxPage />}
    </Suspense>
  );
}
