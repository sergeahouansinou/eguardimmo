"use client";

import { useCallback, useEffect, useState } from "react";
import { ownerInvitationTokenSchema } from "@/features/auth/ownerInvitationSchemas";
import { forgetOwnerInvitation, readOwnerInvitation, rememberOwnerInvitation } from "@/lib/ownerInvitationIntent";
import { ROUTES } from "@/lib/routes";

export function useOwnerInvitationToken(urlToken: string | null): { token: string | null; discard: () => void } {
  const [token, setToken] = useState<string | null>(() => {
    if (urlToken === null) return readOwnerInvitation();
    const parsed = ownerInvitationTokenSchema.safeParse(urlToken);
    return parsed.success ? parsed.data : null;
  });

  useEffect(() => {
    if (urlToken === null) return;
    if (token === null) forgetOwnerInvitation();
    else rememberOwnerInvitation(token);
    window.history.replaceState(null, "", ROUTES.invitationProprietaire);
  }, [urlToken, token]);

  const discard = useCallback(() => {
    forgetOwnerInvitation();
    setToken(null);
  }, []);

  return { token, discard };
}
