'use client';

import { Select } from '@eguardimmo/ui';
import { useState } from 'react';
import { errorMessage } from '@/console/hooks/core';
import { useChangeOperatorRole, useSetOperatorActive } from '@/console/hooks/mutations';
import { ROLE_LABELS } from '@/console/schemas';
import type { Operator, OperatorRole } from '@/console/schemas';
import { ConfirmDialog } from '@/ui/ConfirmDialog';
import { FormDialog } from '@/ui/FormDialog';
import { useNotify } from '@/ui/notify';

const ROLE_OPTIONS = (Object.keys(ROLE_LABELS) as OperatorRole[]).map((value) => ({ value, label: ROLE_LABELS[value] }));

export function RoleDialog({ operator, onClose }: { operator: Operator | null; onClose: () => void }) {
  return operator ? <RoleForm key={operator.id} operator={operator} onClose={onClose} /> : null;
}

function RoleForm({ operator, onClose }: { operator: Operator; onClose: () => void }) {
  const notify = useNotify();
  const change = useChangeOperatorRole(operator.id);
  const [role, setRole] = useState<OperatorRole>(operator.role);
  const [failure, setFailure] = useState<string | null>(null);
  return (
    <FormDialog
      open
      onOpenChange={(open) => { if (!open) onClose(); }}
      title={`Changer le rôle de ${operator.name}`}
      description="Les nouveaux droits s’appliquent à sa prochaine requête. Le changement est consigné au journal d’audit."
      submitLabel="Changer le rôle"
      pending={change.isPending}
      failure={failure}
      onSubmit={(event) => {
        event.preventDefault();
        setFailure(null);
        change.mutate(
          { role },
          {
            onSuccess: () => {
              notify.success('Rôle modifié', `${operator.name} est maintenant ${ROLE_LABELS[role].toLowerCase()}.`);
              onClose();
            },
            onError: (error) => { setFailure(errorMessage(error)); },
          },
        );
      }}
    >
      <Select label="Nouveau rôle" placeholder="Choisir un rôle" options={ROLE_OPTIONS} value={role} onValueChange={(value) => { setRole(value as OperatorRole); }} />
    </FormDialog>
  );
}

export function ActiveDialog({ operator, onClose }: { operator: Operator | null; onClose: () => void }) {
  const notify = useNotify();
  const reactivate = operator?.state === 'desactive';
  const setActive = useSetOperatorActive(operator?.id ?? '');
  return (
    <ConfirmDialog
      open={operator !== null}
      onOpenChange={(open) => { if (!open) onClose(); }}
      title={reactivate ? `Réactiver ${operator.name}` : `Désactiver ${operator?.name ?? ''}`}
      description={
        reactivate
          ? 'Cet opérateur retrouvera l’accès à la console avec son rôle actuel.'
          : 'Ses sessions sont révoquées et il ne pourra plus se connecter. L’opération est consignée au journal d’audit.'
      }
      confirmLabel={reactivate ? 'Réactiver l’accès' : 'Désactiver l’accès'}
      tone={reactivate ? 'primary' : 'danger'}
      onConfirm={async () => {
        await setActive.mutateAsync(reactivate);
        notify.success(reactivate ? 'Accès réactivé' : 'Accès désactivé', 'L’opération est consignée au journal d’audit.');
        onClose();
      }}
    />
  );
}
