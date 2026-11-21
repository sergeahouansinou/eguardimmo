import { ApiError } from '@eguardimmo/api';
import { Alert } from '@eguardimmo/ui';
import type { LinkComponent } from '@eguardimmo/ui';
import { isPlanFeatureError, isPlanLimitError, planLimitMessage, SUBSCRIPTION_PATH } from './planLimit';

const messageOf = (error: Error): string => (error instanceof ApiError ? (planLimitMessage(error) ?? error.message) : error.message);

export function PlanLimitAlert({ error, Link }: { error: unknown; Link: LinkComponent }) {
  if (!isPlanLimitError(error)) return null;
  return (
    <Alert tone="warning" title={isPlanFeatureError(error) ? 'Fonction absente de votre plan' : 'Limite de votre plan atteinte'}>
      {error instanceof Error ? messageOf(error) : null}{' '}
      <Link href={SUBSCRIPTION_PATH} className="font-medium text-action-on-subtle underline underline-offset-2">Voir mon abonnement</Link>
    </Alert>
  );
}
