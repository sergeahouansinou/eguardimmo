'use client';

import { Alert, Button, Dialog, DialogClose, DialogContent, TextField } from '@eguardimmo/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { OWNER_FUNDS_ROOT } from './hooks';
import type { PayoutAccountRequest } from './model';
import { ActionError } from './parts';
import { useOwnerFundsSource } from './source';
import { useNotify } from '../../locataires/kit';
import type { TwoFactorProof } from '../../reauth';

export interface ApproveTarget {
  request: PayoutAccountRequest;
  name: string;
}

export function ApproveRequestDialog({ target, proof, onClose }: { target: ApproveTarget | null; proof: TwoFactorProof; onClose: () => void }) {
  return (
    <Dialog open={target !== null} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent
        title="Approuver le changement d’IBAN"
        description={target ? `Demande de ${target.name}${target.request.bankLast4 === null ? '' : `, IBAN se terminant par ${target.request.bankLast4}`}. Relisez la pièce du RIB, puis ressaisissez ce qu’elle porte.` : ''}
        className="max-w-[520px]"
      >
        {target ? <ApproveForm key={target.request.id} target={target} proof={proof} onClose={onClose} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function ApproveForm({ target, proof, onClose }: { target: ApproveTarget; proof: TwoFactorProof; onClose: () => void }) {
  const source = useOwnerFundsSource();
  const client = useQueryClient();
  const notify = useNotify();
  const [iban, setIban] = useState('');
  const [holder, setHolder] = useState('');
  const [errors, setErrors] = useState<{ iban?: string; holder?: string }>({});
  const [failure, setFailure] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (): Promise<void> => {
    const next: { iban?: string; holder?: string } = {};
    if (iban.replace(/\s+/g, '') === '') next.iban = 'Saisissez l’IBAN lu sur la pièce du RIB.';
    if (holder.trim() === '') next.holder = 'Saisissez le titulaire lu sur la pièce du RIB.';
    setErrors(next);
    setFailure(null);
    if (Object.keys(next).length > 0) return;
    setLoading(true);
    try {
      await source.approvePayoutRequest(target.request.id, { lockVersion: target.request.lockVersion, iban, holderName: holder });
      void client.invalidateQueries({ queryKey: OWNER_FUNDS_ROOT });
      notify({ title: 'Changement approuvé', description: `${target.name} : le nouveau compte est actif, la période de carence de l’agence s’applique avant son premier virement.` });
      onClose();
    } catch (error) {
      const abandon = (): void => {
        setLoading(false);
        setFailure(error);
      };
      if (proof.intercept(error, () => { void submit(); }, abandon)) return;
      void client.invalidateQueries({ queryKey: OWNER_FUNDS_ROOT });
      abandon();
    }
  };

  return (
    <form
      noValidate
      className="flex flex-col gap-3 p-4"
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        void submit();
      }}
    >
      <Alert tone="info" title="Contrôle à faire avant d’approuver">
        Ouvrez la pièce, vérifiez que le titulaire est bien le mandant, et appelez-le au numéro que vous connaissiez déjà. Le serveur compare votre saisie par empreinte : l’IBAN n’est ni affiché, ni conservé, ni consigné.
      </Alert>
      <TextField
        label="IBAN lu sur la pièce *"
        placeholder="FR76 …"
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        value={iban}
        error={errors.iban}
        onChange={(event) => { setIban(event.target.value); }}
        data-autofocus
      />
      <TextField
        label="Titulaire du compte lu sur la pièce *"
        placeholder="Nom du titulaire"
        autoComplete="off"
        value={holder}
        error={errors.holder}
        onChange={(event) => { setHolder(event.target.value); }}
      />
      {failure === null ? null : <ActionError title="Changement non approuvé" error={failure} />}
      <div className="flex flex-wrap justify-end gap-2">
        <DialogClose asChild>
          <Button variant="ghost">Retour</Button>
        </DialogClose>
        <Button type="submit" loading={loading}>Approuver le changement</Button>
      </div>
    </form>
  );
}
