import { Alert } from '@eguardimmo/ui';

export function FormAlerts({ errors, failed, failureTitle }: { errors: Record<string, string>; failed: boolean; failureTitle: string }) {
  const first = Object.values(errors)[0];
  return (
    <>
      {first ? (
        <Alert tone="danger" title="Enregistrement impossible">
          {first}
        </Alert>
      ) : null}
      {failed ? (
        <Alert tone="danger" title={failureTitle}>
          Réessayez dans un instant.
        </Alert>
      ) : null}
    </>
  );
}
