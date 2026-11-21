'use client';

import { Alert, Badge, Button, Card, CardHeader, CardTitle, EmptyState } from '@eguardimmo/ui';
import { Smartphone } from 'lucide-react';
import { useState } from 'react';
import { describeAccountFailure } from './failure';
import { formatDate, formatDateTime } from './format';
import type { AccountDevice } from './model';
import { FailureNotice, Loading } from './parts';
import { useAccountDevices, useRevokeDevice } from './queries';
import { RevokeDeviceDialog } from './RevokeDeviceDialog';
import type { AccountPanelProps } from './AccountIdentityPanel';

function lastActivity(device: AccountDevice, timeZone: string | undefined): string {
  if (device.lastUsedAt !== null) return `Dernière activité le ${formatDateTime(device.lastUsedAt, timeZone)}`;
  return `Ajouté le ${formatDate(device.createdAt, timeZone)}, jamais utilisé depuis`;
}

export function DevicesCard({ client, timeZone }: AccountPanelProps) {
  const devices = useAccountDevices(client);
  const revoke = useRevokeDevice(client);
  const [target, setTarget] = useState<AccountDevice | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const cancel = () => {
    setTarget(null);
    revoke.reset();
  };
  const confirm = () => {
    if (target === null) return;
    const name = target.name;
    revoke.mutate(target.id, {
      onSuccess: () => {
        setTarget(null);
        setNotice(`« ${name} » a été déconnecté.`);
      },
      onError: (error) => {
        if (describeAccountFailure(error).kind !== 'notFound') return;
        setTarget(null);
        revoke.reset();
        setNotice(`« ${name} » était déjà déconnecté. La liste est mise à jour.`);
      },
    });
  };

  return (
    <Card role="region" aria-label="Appareils mobiles connectés">
      <CardHeader>
        <CardTitle as="h2">Appareils mobiles connectés</CardTitle>
      </CardHeader>
      {notice ? <Alert tone="success">{notice}</Alert> : null}
      {devices.data === undefined ? (
        devices.isError ? (
          <FailureNotice title="Vos appareils n’ont pas pu être chargés" error={devices.error} onRetry={() => void devices.refetch()} />
        ) : (
          <Loading label="Chargement de vos appareils" rows={2} />
        )
      ) : devices.data.length === 0 ? (
        <EmptyState
          icon={Smartphone}
          title="Aucun appareil mobile connecté"
          description="Les appareils où vous êtes connecté avec l’application mobile apparaissent ici. Les sessions de navigateur n’y figurent pas."
        />
      ) : (
        <>
          <ul>
            {devices.data.map((device) => (
              <li key={device.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-line py-3 first:pt-0 last:border-b-0 last:pb-0">
                <div className="min-w-0 flex-1 basis-48">
                  <span className="flex flex-wrap items-center gap-2 text-body text-fg [overflow-wrap:anywhere]">
                    {device.name}
                    {device.current ? <Badge tone="info">Cet appareil</Badge> : null}
                  </span>
                  <span className="block text-caption text-fg-subtle">{lastActivity(device, timeZone)}</span>
                </div>
                {device.current ? null : (
                  <Button
                    variant="secondary"
                    size="sm"
                    aria-label={`Révoquer ${device.name}`}
                    onClick={() => {
                      setNotice(null);
                      setTarget(device);
                    }}
                  >
                    Révoquer
                  </Button>
                )}
              </li>
            ))}
          </ul>
          <p className="text-caption text-fg-subtle">Les sessions de navigateur ne sont pas listées : elles se ferment en vous déconnectant.</p>
        </>
      )}
      <RevokeDeviceDialog
        deviceName={target?.name ?? null}
        loading={revoke.isPending}
        error={revoke.error === null ? null : describeAccountFailure(revoke.error).message}
        onCancel={cancel}
        onConfirm={confirm}
      />
    </Card>
  );
}
