'use client';

import { bailOf } from '../derive';
import { financesPaths } from '../paths';
import type { useExec } from '../parts';
import type { FinancesData } from '../schemas';
import { creanceOptions, openDossierOfBail } from './creances';
import { OpenDossierDialog } from './OpenDossierDialog';

export function OpenDossierFlow({
  data,
  bailId,
  initial,
  exec,
  navigate,
  money,
  onClose,
}: {
  data: FinancesData;
  bailId: string;
  initial: readonly string[];
  exec: ReturnType<typeof useExec>;
  navigate: (href: string) => void;
  money: (minor: number) => string;
  onClose: () => void;
}) {
  const bail = bailOf(data, bailId);
  if (!bail) return null;
  const existing = openDossierOfBail(data, bailId);
  return (
    <OpenDossierDialog
      title="Ouvrir un dossier de recouvrement"
      description={`Cochez les créances en retard de ${bail.locataire} à regrouper dans un seul dossier.`}
      submitLabel={existing ? 'Ajouter au dossier' : 'Ouvrir le dossier'}
      options={creanceOptions(data, bailId)}
      initial={initial}
      existing={existing}
      money={money}
      pending={exec.pending}
      error={exec.error}
      onOpenExisting={existing ? () => { navigate(financesPaths.dossier(existing.id)); } : undefined}
      onClose={() => { onClose(); exec.reset(); }}
      onSubmit={(creances) => {
        if (existing) exec.run({ type: 'addCreances', dossierId: existing.id, creances }, { redirect: financesPaths.dossier(existing.id), onDone: onClose });
        else exec.run({ type: 'openDossier', bailId, creances }, { redirect: 'result', onDone: onClose });
      }}
    />
  );
}
