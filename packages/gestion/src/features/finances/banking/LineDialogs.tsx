'use client';

import { Alert } from '@eguardimmo/ui';
import { useAcceptSuggestions, useRestoreLine, useUndoMatch } from './hooks';
import { actionLabel, explanationText, moneyText, skippedReason } from './labels';
import type { AcceptResult, BankLine } from './model';
import { ConfirmAction } from './parts/ConfirmAction';
import { ReasonDialog } from './parts/ReasonDialog';
import { useNotify } from '../../locataires/kit';
import { useAttemptKey } from '../ownerfunds/attemptKey';

export function AcceptDialog({ lines, onDone, onClose }: { lines: readonly BankLine[] | null; onDone: (result: AcceptResult) => void; onClose: () => void }) {
  const accept = useAcceptSuggestions();
  const attemptKey = useAttemptKey();
  const notify = useNotify();
  const suggestions = (lines ?? []).flatMap((line) => (line.suggestion === null ? [] : [{ line, suggestion: line.suggestion }]));
  const ids = suggestions.map((item) => item.suggestion.id);
  const single = suggestions.length === 1 ? suggestions[0] : undefined;
  return (
    <ConfirmAction
      open={lines !== null}
      title={single ? 'Valider cette proposition ?' : `Valider ${String(suggestions.length)} propositions ?`}
      description={
        single
          ? `${actionLabel[single.suggestion.action]} pour ${moneyText(single.line.signedAmount, { signed: true })}. ${explanationText(single.suggestion.codes)}`
          : 'Chaque proposition est appliquée séparément : celles que le serveur écarte restent à pointer et vous sont listées.'
      }
      confirmLabel={single ? 'Valider la proposition' : 'Valider les propositions'}
      failureTitle="Propositions non validées"
      run={async () => {
        const result = await accept.mutateAsync({ ids, key: attemptKey(JSON.stringify([...ids].sort())) });
        notify({ title: result.accepted.length > 0 ? 'Pointage enregistré' : 'Aucune proposition appliquée', description: `${String(result.accepted.length)} appliquée${result.accepted.length > 1 ? 's' : ''}, ${String(result.skipped.length)} écartée${result.skipped.length > 1 ? 's' : ''}.` });
        onDone(result);
      }}
      onClose={onClose}
    />
  );
}

export function RestoreDialog({ line, onClose }: { line: BankLine | null; onClose: () => void }) {
  const restore = useRestoreLine();
  const notify = useNotify();
  return (
    <ConfirmAction
      open={line !== null}
      title="Restaurer cette ligne ?"
      description="La ligne redevient à pointer et ses propositions seront recalculées."
      confirmLabel="Restaurer la ligne"
      failureTitle="Ligne non restaurée"
      run={async () => {
        if (line === null) return;
        await restore.mutateAsync({ lineId: line.id, lockVersion: line.lockVersion });
        notify({ title: 'Ligne restaurée', description: 'Elle est de nouveau à pointer.' });
      }}
      onClose={onClose}
    />
  );
}

export function UndoDialog({ line, onClose }: { line: BankLine | null; onClose: () => void }) {
  const undo = useUndoMatch();
  const notify = useNotify();
  return (
    <ReasonDialog
      open={line !== null}
      title="Défaire ce pointage ?"
      description="Les écritures créées par ce pointage sont contrepassées et la ligne redevient à pointer. L’action est tracée avec votre motif."
      confirmLabel="Défaire le pointage"
      failureTitle="Pointage non défait"
      placeholder="ex. Pointé sur le mauvais locataire"
      run={async (reason) => {
        if (line?.matchId === null || line === null) return;
        await undo.mutateAsync({ matchId: line.matchId, reason });
        notify({ title: 'Pointage défait', description: 'La ligne est de nouveau à pointer.' });
      }}
      onClose={onClose}
    />
  );
}

export function AcceptSummary({ result, onDismiss }: { result: AcceptResult; onDismiss: () => void }) {
  if (result.skipped.length === 0) return null;
  return (
    <Alert tone="warning" title={`${String(result.skipped.length)} proposition${result.skipped.length > 1 ? 's' : ''} écartée${result.skipped.length > 1 ? 's' : ''}`}>
      <ul className="list-disc pl-5">
        {result.skipped.map((item) => (
          <li key={item.suggestionId}>{skippedReason(item.reason)}</li>
        ))}
      </ul>
      <button type="button" className="mt-1 text-action-on-subtle underline underline-offset-2" onClick={onDismiss}>Masquer ce message</button>
    </Alert>
  );
}
