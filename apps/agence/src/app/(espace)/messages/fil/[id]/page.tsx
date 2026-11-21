import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ApiThreadScreen } from "@/features/messagerie/MessagesScreens";
import { isUuid } from "@/features/messagerie/ids";
import { dataSource } from "@/lib/env";

export const metadata: Metadata = { title: "Conversation" };

export default function Page({ params }: PageProps<"/messages/fil/[id]">) {
  return (
    <Suspense fallback={<div aria-hidden="true" className="h-7 w-48 animate-pulse rounded-sm bg-muted" />}>
      <Screen params={params} />
    </Suspense>
  );
}

async function Screen({ params }: Pick<PageProps<"/messages/fil/[id]">, "params">) {
  const { id } = await params;
  if (dataSource !== "api" || !isUuid(id)) notFound();
  return <ApiThreadScreen id={id} />;
}
