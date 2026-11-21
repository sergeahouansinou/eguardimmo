import { NewMessagePage } from "@eguardimmo/messagerie";
import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ScreenState";
import { ApiNewMessageScreen } from "@/features/conversations/ApiMessageScreens";
import { dataSource } from "@/lib/env";

export const metadata: Metadata = { title: "Nouveau message" };

export default function Page() {
  return <Suspense fallback={<Skeleton />}>{dataSource === "api" ? <ApiNewMessageScreen /> : <NewMessagePage />}</Suspense>;
}
