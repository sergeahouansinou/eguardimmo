"use client";

import { useCallback, useEffect, useState } from "react";
import { tenantInvitationTokenSchema } from "@/features/auth/schemas";
import { ROUTES } from "@/lib/routes";
import { forgetTenantInvitation, readTenantInvitation, rememberTenantInvitation } from "@/lib/tenantInvitationIntent";

export function useTenantInvitationToken(urlToken: string | null): { token: string | null; discard: () => void } {
  const [token, setToken] = useState<string | null>(() => {
    if (urlToken === null) return readTenantInvitation();
    const parsed = tenantInvitationTokenSchema.safeParse(urlToken);
    return parsed.success ? parsed.data : null;
  });

  useEffect(() => {
    if (urlToken === null) return;
    if (token === null) forgetTenantInvitation();
    else rememberTenantInvitation(token);
    window.history.replaceState(null, "", ROUTES.invitationLocataire);
  }, [urlToken, token]);

  const discard = useCallback(() => {
    forgetTenantInvitation();
    setToken(null);
  }, []);

  return { token, discard };
}
