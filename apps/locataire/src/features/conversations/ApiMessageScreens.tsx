"use client";

import { ExternalInboxPage, ExternalNewThreadPage } from "@eguardimmo/messagerie";
import { useSearchParams } from "next/navigation";
import { isUuid } from "@/tenant/ids";

export function ApiInboxScreen() {
  return <ExternalInboxPage />;
}

export function ApiNewMessageScreen() {
  const lease = useSearchParams().get("bail");
  return <ExternalNewThreadPage {...(isUuid(lease) ? { initialOptionId: lease } : {})} />;
}
