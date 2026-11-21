'use client';

import { Button, Icon } from '@eguardimmo/ui';
import { RotateCw } from 'lucide-react';
import { useRetryStatement } from '../hooks';
import { useAttemptKey } from '../../ownerfunds/attemptKey';
import { useNotify } from '../../../locataires/kit';
import { ActionError } from './ActionError';

export function RetryStatementButton({ statementId, size = 'sm' }: { statementId: string; size?: 'sm' | 'md' }) {
  const retry = useRetryStatement();
  const attemptKey = useAttemptKey();
  const notify = useNotify();
  return (
    <>
      <Button
        variant="secondary"
        size={size}
        loading={retry.isPending}
        onClick={() => {
          retry.mutate(
            { id: statementId, key: attemptKey(statementId) },
            { onSuccess: () => { notify({ title: 'Émission reprise', description: 'Le décompte a été émis avec son numéro conservé.' }); } },
          );
        }}
      >
        <Icon icon={RotateCw} />
        Reprendre l’émission
      </Button>
      {retry.isError ? <ActionError title="Émission non reprise" error={retry.error} /> : null}
    </>
  );
}
