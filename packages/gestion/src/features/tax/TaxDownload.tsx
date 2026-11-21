'use client';

import { Button, Icon } from '@eguardimmo/ui';
import { Download } from 'lucide-react';
import { useState } from 'react';
import { saveBlob } from '../finances/rent/download';
import { runWithProof } from '../activity/runWithProof';
import { ActionError } from '../orgapi/ActionError';
import { useOrgInfoSource } from '../orgapi/source';
import { useTwoFactorProof } from '../reauth';

const ABANDONED = 'Téléchargement annulé : votre identité n’a pas été confirmée.';

export function TaxDownload({ label, filename, load }: { label: string; filename: string; load: () => Promise<Blob> }) {
  const info = useOrgInfoSource();
  const proof = useTwoFactorProof(info.confirmTwoFactor);
  const [loading, setLoading] = useState(false);
  const [failure, setFailure] = useState<unknown>(null);

  const run = async () => {
    setLoading(true);
    setFailure(null);
    try {
      saveBlob(await runWithProof(proof, load, ABANDONED), filename);
    } catch (error) {
      setFailure(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button variant="secondary" loading={loading} onClick={() => { void run(); }}>
        <Icon icon={Download} />
        {label}
      </Button>
      {failure === null ? null : <ActionError title="Téléchargement impossible" error={failure} />}
      {proof.dialog}
    </>
  );
}
