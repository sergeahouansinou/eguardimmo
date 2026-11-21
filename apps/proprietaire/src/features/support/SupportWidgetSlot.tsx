"use client";

import { SupportApiWidget, SupportWidget, useOptionalSupportConfig } from "@eguardimmo/messagerie";
import { dataSource } from "@/lib/env";

export function SupportWidgetSlot() {
  const api = useOptionalSupportConfig();
  if (dataSource !== "api") return <SupportWidget />;
  return api === null ? null : <SupportApiWidget />;
}
