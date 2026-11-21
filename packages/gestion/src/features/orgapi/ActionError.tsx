'use client';

import { Alert } from '@eguardimmo/ui';
import { errorMessage, useGestionNavigation } from '../locataires/kit';
import { OrgApiError } from './errors';

export const SECURITY_PATH = '/compte/securite';

export function ActionError({ title, error }: { title: string; error: unknown }) {
  const { Link } = useGestionNavigation();
  const twoFactor = error instanceof OrgApiError && error.kind === 'two_factor_required';
  return (
    <Alert tone="danger" title={title}>
      {errorMessage(error)}
      {twoFactor ? (
        <>
          {' '}
          <Link href={SECURITY_PATH} className="text-action-on-subtle underline underline-offset-2">Ouvrir Connexion et sécurité</Link>
        </>
      ) : null}
    </Alert>
  );
}
