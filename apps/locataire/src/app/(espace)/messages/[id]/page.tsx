import { ConversationPage } from "@eguardimmo/messagerie";
import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ScreenState";
import { conversationIds } from "@/data/staticParams";
import { MessageRoute } from "@/features/conversations/MessageRoute";
import { dataSource } from "@/lib/env";

export const metadata: Metadata = { title: "Conversation" };

export function generateStaticParams() {
  return conversationIds();
}

export default function Page({ params }: PageProps<"/messages/[id]">) {
  return (
    <Suspense fallback={<Skeleton />}>
      {dataSource === "api" ? <MessageRoute params={params} /> : <Screen params={params} />}
    </Suspense>
  );
}

async function Screen({ params }: Pick<PageProps<"/messages/[id]">, "params">) {
  const { id } = await params;
  return <ConversationPage conversationId={id} />;
}
