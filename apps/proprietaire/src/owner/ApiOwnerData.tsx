"use client";

import { NotificationsApiProvider, ShellSourceProvider } from "@eguardimmo/shell";
import { useMemo } from "react";
import type { ReactNode } from "react";
import { apiEnv } from "@/lib/env";
import { OwnerAnnouncementsProvider } from "./announcements/AnnouncementsProvider";
import { ConversationsProvider } from "./conversations/ConversationsProvider";
import { OwnerSelectionProvider } from "./selection";
import { OwnerGate, useOwnerSession } from "./session";
import { createApiShellSource } from "./shellSource";
import { OwnerSupportProvider } from "./support/OwnerSupportProvider";

function Bridge({ children }: { children: ReactNode }) {
  const { client } = useOwnerSession();
  const shell = useMemo(() => createApiShellSource(client), [client]);
  return (
    <ShellSourceProvider source={shell}>
      <NotificationsApiProvider client={client} organizationId={null}>
        <OwnerSelectionProvider>
          <OwnerSupportProvider>
            <ConversationsProvider>
              <OwnerAnnouncementsProvider>{children}</OwnerAnnouncementsProvider>
            </ConversationsProvider>
          </OwnerSupportProvider>
        </OwnerSelectionProvider>
      </NotificationsApiProvider>
    </ShellSourceProvider>
  );
}

export function ApiOwnerData({ children }: { children: ReactNode }) {
  const env = apiEnv();
  return (
    <OwnerGate apiUrl={env.NEXT_PUBLIC_API_URL} authUrl={env.NEXT_PUBLIC_AUTH_URL}>
      <Bridge>{children}</Bridge>
    </OwnerGate>
  );
}
