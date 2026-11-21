"use client";

import { useEffect, useState } from "react";
import { Loading, Retry } from "@/components/InvitationFeedback";
import { useHydrated, useSession, useSignOut, useTenantInvitationPreview } from "@/features/auth/queries";
import { forgetTenantInvitation } from "@/lib/tenantInvitationIntent";
import { TenantConsentForm } from "./TenantConsentForm";
import type { ScreenOutcome } from "./TenantConsentForm";
import {
  EmailMismatchScreen,
  EmailUnverifiedScreen,
  InvalidInvitationScreen,
  SignedOutScreen,
  SuccessScreen,
} from "./TenantInvitationStates";
import { rateLimitedMessage } from "./tenantInvitationCopy";
import { useTenantInvitationToken } from "./useTenantInvitationToken";

function InvitationFlow({ token, email, onInvalid }: { token: string; email: string; onInvalid: () => void }) {
  const preview = useTenantInvitationPreview(token, true);
  const session = useSession();
  const signOut = useSignOut();
  const [outcome, setOutcome] = useState<{ status: Exclude<ScreenOutcome, "invalid" | "unauthenticated">; organisation: string } | null>(null);
  const [forced, setForced] = useState<"email_mismatch" | "email_unverified" | null>(null);

  const leave = () => {
    signOut.mutate(undefined);
  };

  const invalid = preview.data?.status === "invalid";
  useEffect(() => {
    if (invalid) onInvalid();
  }, [invalid, onInvalid]);

  if (outcome?.status === "accepted") return <SuccessScreen organisation={outcome.organisation} />;
  if (preview.isError) {
    return (
      <Retry
        title="Impossible de vérifier l’invitation"
        message="Le serveur n’a pas répondu comme prévu. Votre invitation reste valable : réessayez dans un instant."
        onRetry={preview.refetch}
      />
    );
  }
  if (!preview.data) return <Loading label="Vérification de l’invitation" />;

  const status = forced ?? preview.data.status;
  if (status === "invalid") return <InvalidInvitationScreen />;
  if (status === "unauthenticated") return <SignedOutScreen />;
  if (status === "email_mismatch") return <EmailMismatchScreen email={email} onSignOut={leave} pending={signOut.isPending} />;
  if (status === "email_unverified") {
    return (
      <EmailUnverifiedScreen
        pending={preview.isFetching === true}
        onRetry={() => {
          setForced(null);
          preview.refetch();
        }}
      />
    );
  }
  if (preview.data.status === "rate_limited") {
    return (
      <Retry
        title="Trop de tentatives."
        message={rateLimitedMessage(preview.data.retryAfterSeconds)}
        onRetry={preview.refetch}
      />
    );
  }
  if (preview.data.status !== "valid") return <Loading label="Vérification de l’invitation" />;

  const { organizationName, expiresAt } = preview.data;
  return (
    <TenantConsentForm
      token={token}
      organisation={organizationName}
      expiresAt={expiresAt}
      email={email}
      onSignOut={leave}
      onOutcome={(next) => {
        if (next === "accepted") {
          forgetTenantInvitation();
          setOutcome({ status: next, organisation: organizationName });
        } else if (next === "email_mismatch" || next === "email_unverified") setForced(next);
        else if (next === "unauthenticated") session.refetch();
        else onInvalid();
      }}
    />
  );
}

export function TenantInvitationScreen({ urlToken }: { urlToken: string | null }) {
  const hydrated = useHydrated();
  const { token, discard } = useTenantInvitationToken(urlToken);
  const session = useSession();

  if (!hydrated) return <Loading label="Chargement de l’invitation" />;
  if (token === null) return <InvalidInvitationScreen />;
  if (session.isError) {
    return <Retry title="Impossible de vérifier votre session" message="Le serveur n’a pas répondu. Réessayez dans un instant." onRetry={session.refetch} />;
  }
  if (session.isPending) return <Loading label="Vérification de votre session" />;
  if (session.data === null || session.data === undefined) return <SignedOutScreen />;
  return <InvitationFlow token={token} email={session.data.email} onInvalid={discard} />;
}
