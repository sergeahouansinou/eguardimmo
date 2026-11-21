'use client';

import { Alert } from '@eguardimmo/ui';
import { errorMessage, useGestionNavigation } from '../../../locataires/kit';
import { TenantRequestsError } from '../errors';
import { tenantRequestsPaths } from '../paths';

export function ActionError({ title, error }: { title: string; error: unknown }) {
  const { Link } = useGestionNavigation();
  const twoFactor = error instanceof TenantRequestsError && error.kind === 'two_factor_required';
  return (
    <Alert tone="danger" title={title}>
      {errorMessage(error)}
      {twoFactor ? (
        <>
          {' '}
          <Link href={tenantRequestsPaths.security} className="text-action-on-subtle underline underline-offset-2">Ouvrir Connexion et sécurité</Link>
        </>
      ) : null}
    </Alert>
  );
}
