"use client";

import { ExternalMessagerieProvider, createExternalApiSource } from "@eguardimmo/messagerie";
import type { ExternalRoutes } from "@eguardimmo/messagerie";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import type { ReactNode } from "react";
import { confieRoutes } from "@/features/confie/routes";
import { useOwnerSession } from "../session";

export const conversationRoutes: ExternalRoutes = {
  inbox: confieRoutes.messages,
  thread: (id) => `${confieRoutes.messages}/${id}`,
  newThread: confieRoutes.messageNouveau,
};

export function ConversationsProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { client } = useOwnerSession();
  const source = useMemo(() => createExternalApiSource({ client, space: "owner" }), [client]);
  return (
    <ExternalMessagerieProvider
      space="owner"
      source={source}
      routes={conversationRoutes}
      Link={Link}
      navigate={(href) => { router.push(href); }}
    >
      {children}
    </ExternalMessagerieProvider>
  );
}
