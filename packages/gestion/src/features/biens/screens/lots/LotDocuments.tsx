'use client';

import { DocumentsPanel } from '../../components/DocumentsPanel';
import { EntryList, Panel } from '../../components/Panels';
import { useLotLease } from '../../queries';

const ANNEXES = [
  { id: 'ddt', title: 'Dossier de diagnostic technique', detail: 'DPE, risques, électricité, amiante' },
  { id: 'notice', title: 'Notice d’information', detail: 'Modèle fixé par arrêté' },
  { id: 'edl', title: 'État des lieux d’entrée', detail: 'À signer avec le locataire' },
  { id: 'copro', title: 'Extraits du règlement de copropriété', detail: 'Destination et charges' },
  { id: 'assurance', title: 'Attestation d’assurance du locataire', detail: 'À renouveler chaque année' },
  { id: 'caution', title: 'Acte de cautionnement', detail: 'Seulement si le bail a un garant' },
];

export function LotDocuments({ id }: { id: string }) {
  const lease = useLotLease(id);
  return (
    <>
      <DocumentsPanel owner={{ kind: 'lot', id }} title="Documents du lot" />
      {lease.data ? (
        <Panel title="Annexes du bail en cours">
          <p className="text-caption text-fg-subtle">Pièces à remettre au locataire, loi du 6 juillet 1989</p>
          <EntryList label="Annexes du bail" items={ANNEXES} />
        </Panel>
      ) : null}
    </>
  );
}
