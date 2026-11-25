"use client";

import { orgKey, useOrgInfinite, useOrgMutation } from "@/features/org/queries";
import { useRgpdSource } from "./RgpdSourceProvider";

const MODULE = "rgpd";

export function usePrivacyRequests() {
  const source = useRgpdSource();
  return useOrgInfinite(orgKey(MODULE, "demandes"), (cursor) => source.list(cursor));
}

export function useMarkHandled() {
  const source = useRgpdSource();
  return useOrgMutation(MODULE, (id: string) => source.markHandled(id));
}
