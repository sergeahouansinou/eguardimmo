'use client';

import { Dialog, DialogContent } from '@eguardimmo/ui';
import { useEffect, useState } from 'react';
import { useAttestation } from './hooks';
import type { InsuranceSubmission } from './model';
import { QueryState } from '../shared/parts/QueryState';

export function AttestationDialog({ submission, tenant, onClose }: { submission: InsuranceSubmission | null; tenant: string; onClose: () => void }) {
  return (
    <Dialog open={submission !== null} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent
        title={`Attestation de ${tenant}`}
        description={submission === null ? undefined : `${submission.insurer}, contrat ${submission.policyNumber}`}
        className="max-w-[760px]"
      >
        {submission === null ? null : <AttestationViewer submissionId={submission.id} />}
      </DialogContent>
    </Dialog>
  );
}

function AttestationViewer({ submissionId }: { submissionId: string }) {
  const attestation = useAttestation(submissionId);
  const [url, setUrl] = useState<string | null>(null);
  const blob = attestation.data;

  useEffect(() => {
    if (blob === undefined) return undefined;
    let active = true;
    const objectUrl = URL.createObjectURL(blob);
    void Promise.resolve().then(() => {
      if (active) setUrl(objectUrl);
    });
    return () => {
      active = false;
      URL.revokeObjectURL(objectUrl);
      setUrl(null);
    };
  }, [blob]);

  if (blob === undefined || url === null) {
    return <div className="p-4"><QueryState query={attestation} label="Chargement de l’attestation" title="Impossible d’afficher l’attestation" /></div>;
  }
  if (blob.type.startsWith('image/')) {
    return <img src={url} alt="Attestation d’assurance déposée par le locataire" className="mx-auto max-h-[70vh] max-w-full p-4" />;
  }
  return <iframe src={url} title="Attestation d’assurance déposée par le locataire" className="h-[70vh] w-full border-0" />;
}
