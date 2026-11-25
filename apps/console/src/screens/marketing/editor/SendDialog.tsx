'use client';

import { Alert, Button, Dialog, DialogClose, DialogContent } from '@eguardimmo/ui';
import { useState } from 'react';
import { formatInteger, plural } from '@/lib/format';
import type { CampaignDetail } from '@/platform/marketing/marketing';
import { useNotify } from '@/ui/notify';
import { PlatformState } from '@/ui/PlatformState';
import { KeyValueList } from '@/ui/Section';
import { useEstimate, useSendCampaign } from '../hooks';
import { campaignProblem } from '../labels';
import type { CampaignProblem } from '../labels';

export interface SendDialogProps {
  campaign: CampaignDetail;
  onClose: () => void;
  onReload: () => void;
}

export function SendDialog({ campaign, onClose, onReload }: SendDialogProps) {
  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent title="Envoyer la campagne" description="L’envoi est définitif : une campagne envoyée ne se modifie plus et ne s’annule pas.">
        <SendBody campaign={campaign} onClose={onClose} onReload={onReload} />
      </DialogContent>
    </Dialog>
  );
}

function SendBody({ campaign, onClose, onReload }: SendDialogProps) {
  const notify = useNotify();
  const estimate = useEstimate(campaign.id, campaign.lock_version);
  const send = useSendCampaign();
  const [failure, setFailure] = useState<CampaignProblem | null>(null);
  const eligible = estimate.data?.eligible ?? 0;

  const confirm = async () => {
    setFailure(null);
    try {
      await send.mutateAsync({ id: campaign.id, lockVersion: campaign.lock_version });
      notify.success('Envoi lancé');
      onClose();
    } catch (error) {
      setFailure(campaignProblem(error));
    }
  };

  return (
    <div className="flex flex-col gap-3 px-4 pt-3 pb-4">
      <PlatformState query={estimate} label="Le calcul des destinataires">
        {(data) => (
          <>
            <KeyValueList
              labelWidth="sm:grid-cols-[220px_minmax(0,1fr)]"
              items={[
                { label: 'Comptes visés', value: formatInteger(data.total) },
                { label: 'Éligibles', value: formatInteger(data.eligible) },
                { label: 'Exclus sans consentement', value: formatInteger(data.excluded_no_consent) },
                { label: 'Injoignables', value: formatInteger(data.excluded_unreachable) },
              ]}
            />
            {data.eligible === 0 ? <Alert tone="warning">Envoi impossible : aucun destinataire éligible.</Alert> : null}
          </>
        )}
      </PlatformState>
      {failure ? (
        <Alert tone="danger" title="La campagne n’a pas été envoyée">
          <span className="flex flex-wrap items-center gap-2">
            {failure.message}
            {failure.reloadable ? (
              <Button variant="link" onClick={() => { onClose(); onReload(); }}>
                Recharger la campagne
              </Button>
            ) : null}
          </span>
        </Alert>
      ) : null}
      <div className="flex flex-wrap justify-end gap-2">
        <DialogClose asChild>
          <Button variant="secondary">Annuler</Button>
        </DialogClose>
        <Button loading={send.isPending} disabled={eligible === 0} onClick={() => { void confirm(); }}>
          {eligible === 0 ? 'Envoyer' : `Envoyer à ${plural(eligible, 'compte')}`}
        </Button>
      </div>
    </div>
  );
}
