'use client';

import { Alert } from '@eguardimmo/ui';
import { BankingApiError } from '../api/bankingErrors';
import { errorMessage, useGestionNavigation } from '../../../locataires/kit';
import { bankingPaths } from '../paths';

export function ActionError({ title, error }: { title: string; error: unknown }) {
  const { Link } = useGestionNavigation();
  const twoFactor = error instanceof BankingApiError && error.kind === 'two_factor_required';
  return (
    <Alert tone="danger" title={title}>
      {errorMessage(error)}
      {twoFactor ? (
        <>
          {' '}
          <Link href={bankingPaths.security} className="text-action-on-subtle underline underline-offset-2">Ouvrir Connexion et sécurité</Link>
        </>
      ) : null}
    </Alert>
  );
}
