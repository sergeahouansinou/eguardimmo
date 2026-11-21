'use client';

import { Alert, Button, Dialog, DialogContent, TextField } from '@eguardimmo/ui';
import { useState, useSyncExternalStore } from 'react';
import type { SubmitEvent } from 'react';
import type { OperatorProof, ProofBroker, ProofKind } from '@/platform/proof';

const TOTP_PATTERN = /^\d{6}$/;

export function normalizeProof(kind: ProofKind, raw: string): OperatorProof | null {
  const code = kind === 'totp' ? raw.replace(/\s+/g, '') : raw.trim();
  if (kind === 'totp' ? !TOTP_PATTERN.test(code) : code === '') return null;
  return { kind, code };
}

function ProofForm({ rejected, onAnswer }: { rejected: boolean; onAnswer: (proof: OperatorProof | null) => void }) {
  const [kind, setKind] = useState<ProofKind>('totp');
  const [code, setCode] = useState('');
  const [invalid, setInvalid] = useState(false);

  const submit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const proof = normalizeProof(kind, code);
    if (proof === null) {
      setInvalid(true);
      return;
    }
    onAnswer(proof);
  };

  const recovery = kind === 'recovery';
  const error = invalid ? (recovery ? 'Saisissez un code de secours.' : 'Saisissez les 6 chiffres affichés par votre application.') : undefined;

  return (
    <form noValidate onSubmit={submit} className="flex flex-col gap-3 px-4 pt-3 pb-4">
      {rejected ? <Alert tone="danger">Ce code est incorrect ou a déjà été utilisé. Saisissez-en un nouveau.</Alert> : null}
      <TextField
        label={recovery ? 'Code de secours' : 'Code de double authentification'}
        placeholder={recovery ? 'abcde-fghij' : '123456'}
        value={code}
        error={error}
        hint={recovery ? 'Chaque code de secours ne sert qu’une fois.' : 'Un nouveau code est demandé pour chaque action.'}
        inputMode={recovery ? 'text' : 'numeric'}
        autoComplete={recovery ? 'off' : 'one-time-code'}
        spellCheck={false}
        onChange={(event) => {
          setCode(event.target.value);
          setInvalid(false);
        }}
        data-autofocus
      />
      <div>
        <Button
          type="button"
          variant="link"
          onClick={() => {
            setKind(recovery ? 'totp' : 'recovery');
            setCode('');
            setInvalid(false);
          }}
        >
          {recovery ? 'Utiliser le code de mon application' : 'Utiliser un code de secours'}
        </Button>
      </div>
      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="secondary" onClick={() => { onAnswer(null); }}>
          Annuler
        </Button>
        <Button type="submit">Confirmer</Button>
      </div>
    </form>
  );
}

export function ProofDialogHost({ broker }: { broker: ProofBroker }) {
  const request = useSyncExternalStore(broker.subscribe, broker.current, () => null);
  return (
    <Dialog
      open={request !== null}
      onOpenChange={(open) => {
        if (!open && request !== null) broker.answer(request.id, null);
      }}
    >
      <DialogContent title="Confirmer avec votre code" description="Cette action modifie l’état de la plateforme : confirmez que c’est bien vous.">
        {request === null ? null : (
          <ProofForm
            key={`${String(request.id)}-${String(request.rejected)}`}
            rejected={request.rejected}
            onAnswer={(proof) => { broker.answer(request.id, proof); }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
