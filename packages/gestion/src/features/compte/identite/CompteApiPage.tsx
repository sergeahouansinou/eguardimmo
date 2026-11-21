'use client';

import { AccountIdentityPanel, AccountSecurityPanel, useOrganizationSession } from '@eguardimmo/shell';

function useSessionClient() {
  const session = useOrganizationSession();
  if (session === null) throw new Error('OrganizationGate manquant autour des écrans du compte.');
  return session.client;
}

export function CompteApiPage() {
  const client = useSessionClient();
  return (
    <>
      <header className="flex flex-col gap-1">
        <h1 className="text-page-title">Mon compte</h1>
        <p className="text-body text-fg-muted">Votre identité et vos espaces, tels qu’ils figurent sur votre compte eGuardImmo.</p>
      </header>
      <AccountIdentityPanel client={client} />
    </>
  );
}

export function SecuriteApiPage() {
  const client = useSessionClient();
  return (
    <>
      <header className="flex flex-col gap-1">
        <h1 className="text-page-title">Connexion et sécurité</h1>
        <p className="text-body text-fg-muted">Mot de passe, double authentification et appareils sont communs à tous vos espaces eGuardImmo.</p>
      </header>
      <AccountSecurityPanel client={client} />
    </>
  );
}
