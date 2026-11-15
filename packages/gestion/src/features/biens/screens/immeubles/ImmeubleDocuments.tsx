'use client';

import { DocumentsPanel } from '../../components/DocumentsPanel';
import { EntryList, Panel } from '../../components/Panels';

const DOSSIER = [
  { id: 'reglement', title: 'Règlement et état descriptif', detail: 'Extraits annexés au bail' },
  { id: 'fiche', title: 'Fiche synthétique', detail: 'Mise à jour chaque année' },
  { id: 'dpe', title: 'DPE collectif et plan de travaux', detail: 'Joints au dossier de vente' },
  { id: 'amiante', title: 'Dossier technique amiante', detail: 'À demander au syndic' },
  { id: 'carnet', title: 'Carnet d’entretien de l’immeuble', detail: 'À demander au syndic' },
];

export function ImmeubleDocuments({ id }: { id: string }) {
  return (
    <>
      <DocumentsPanel owner={{ kind: 'immeuble', id }} title="Documents de l’immeuble" showShare={false} />
      <Panel title="Dossier de la copropriété">
        <p className="text-caption text-fg-subtle">Pièces à détenir, utiles au bail et à la vente</p>
        <EntryList label="Dossier de la copropriété" items={DOSSIER} />
      </Panel>
    </>
  );
}
