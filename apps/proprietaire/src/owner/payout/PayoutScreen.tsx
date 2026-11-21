"use client";

import { Alert, EmptyState } from "@eguardimmo/ui";
import { Landmark } from "lucide-react";
import { useState } from "react";
import { PageHeader } from "@/features/confie/ui/PageHeader";
import { FailureNotice, Loading } from "../screens/FailureNotice";
import { AccountCard } from "./AccountCard";
import type { PayoutNotice } from "./AccountCard";
import { usePayoutAccounts } from "./queries";

export function PayoutScreen() {
  const accounts = usePayoutAccounts();
  const [notice, setNotice] = useState<PayoutNotice | null>(null);
  return (
    <>
      <PageHeader title="Compte de paiement" subtitle="Le compte sur lequel votre agence vous reverse vos loyers" />
      <Alert tone="info" title="Votre IBAN n’est jamais affiché">
        Seuls les quatre derniers caractères du compte sont montrés. Un changement est confirmé par un code reçu par e-mail, puis vérifié par votre agence avant d’être activé.
      </Alert>
      {notice === null ? null : (
        <Alert tone="success" title={notice.title}>
          {notice.text}
        </Alert>
      )}
      {accounts.isPending ? <Loading label="Chargement du compte de paiement" /> : null}
      {accounts.isError ? <FailureNotice title="Votre compte de paiement n’a pas pu être chargé" error={accounts.error} onRetry={() => void accounts.refetch()} /> : null}
      {accounts.isSuccess && accounts.data.length === 0 ? (
        <EmptyState icon={Landmark} title="Aucun compte de paiement" description="Aucun de vos accès ne permet de gérer un compte de paiement." />
      ) : null}
      {accounts.isSuccess ? accounts.data.map((account) => <AccountCard key={account.accessId} account={account} onNotice={setNotice} />) : null}
    </>
  );
}
