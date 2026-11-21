'use client';

import { Button, Icon } from '@eguardimmo/ui';
import { Download } from 'lucide-react';
import { useState } from 'react';
import { saveBlob } from '../finances/rent/download';
import { ConfirmAction } from '../orgapi/ConfirmAction';
import { useOrgInfoSource } from '../orgapi/source';
import { useOrgTimezone } from '../orgapi/hooks';
import { todayIn } from '../orgapi/zone';
import { useTwoFactorProof } from '../reauth';
import { useExportActivity } from './hooks';
import { runWithProof } from './runWithProof';
import type { ActivityFilters } from './model';

const ABANDONED = 'Export annulé : votre identité n’a pas été confirmée.';

export function ExportActivity({ filters }: { filters: ActivityFilters }) {
  const [open, setOpen] = useState(false);
  const info = useOrgInfoSource();
  const proof = useTwoFactorProof(info.confirmTwoFactor);
  const exporter = useExportActivity();
  const timezone = useOrgTimezone();

  const run = async () => {
    const blob = await runWithProof(proof, () => exporter.mutateAsync(filters), ABANDONED);
    saveBlob(blob, `journal-activite-${todayIn(timezone.data ?? 'UTC')}.csv`);
  };

  return (
    <>
      <Button variant="secondary" onClick={() => { setOpen(true); }}>
        <Icon icon={Download} />
        Exporter en CSV
      </Button>
      <ConfirmAction
        open={open}
        title="Exporter le journal d’activité"
        description="Le fichier CSV reprend les filtres appliqués. Il contient des données personnelles : conservez-le avec soin. Cet export est lui-même tracé dans le journal, et limité à 5 par heure."
        confirmLabel="Exporter"
        failureTitle="Export impossible"
        run={run}
        onClose={() => { setOpen(false); }}
      />
      {proof.dialog}
    </>
  );
}
