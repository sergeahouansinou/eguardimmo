"use client";

import { Alert } from "@eguardimmo/ui";
import { useSearchParams } from "next/navigation";
import { useSecurity } from "@/features/auth/queries";
import { providerSchema } from "@/features/auth/schemas";
import { ROUTES } from "@/lib/routes";
import { LinkedAccountRows } from "./LinkedAccountRows";
import { PageHead, Section } from "./parts";
import { QueryState } from "./QueryState";

const PROVIDER_LABELS = { google: "Google", apple: "Apple" } as const;

function ComptesLiesContent({ conflict = false }: { conflict?: boolean }) {
  const security = useSecurity();
  const parsed = providerSchema.safeParse(useSearchParams().get("fournisseur"));
  const provider = parsed.success ? parsed.data : "google";
  return (
    <>
      <PageHead
        crumbs={
          conflict
            ? [{ label: "Mon compte", href: ROUTES.compte }, { label: "Comptes liés", href: ROUTES.comptesLies }, { label: "Liaison impossible" }]
            : [{ label: "Mon compte", href: ROUTES.compte }, { label: "Comptes liés" }]
        }
        title="Comptes liés"
        description="Connectez-vous plus vite avec Google ou Apple. Votre compte eGuardImmo reste le même."
      />
      {conflict ? (
        <Alert tone="danger" title={`Ce compte ${PROVIDER_LABELS[provider]} est déjà lié à un autre compte eGuardImmo.`}>
          Déliez-le depuis cet autre compte, ou liez un autre compte {PROVIDER_LABELS[provider]} à celui-ci.
        </Alert>
      ) : null}
      <QueryState isPending={security.isPending} isError={security.isError} refetch={security.refetch} label="comptes liés">
        {security.data ? (
          <Section id="l1" title="Fournisseurs">
            <LinkedAccountRows
              accounts={security.data.linkedAccounts}
              confirmedUntil={security.data.confirmedUntil}
              conflictProvider={conflict ? provider : undefined}
            />
          </Section>
        ) : null}
      </QueryState>
      {conflict ? null : (
        <Alert tone="info" title="Confirmation requise pour lier un compte.">
          Nous vous demanderons votre mot de passe ou un code de double authentification.
        </Alert>
      )}
    </>
  );
}

export function ComptesLiesScreen() {
  return <ComptesLiesContent />;
}

export function LiaisonConflitScreen() {
  return <ComptesLiesContent conflict />;
}
