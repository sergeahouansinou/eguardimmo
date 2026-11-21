'use client';

import { Alert, Button, Card, CardContent, CardHeader, CardTitle, ConfirmDialog, EmptyState, Icon } from '@eguardimmo/ui';
import { Download, FilePlus2, Package, Send } from 'lucide-react';
import { useState } from 'react';
import { TransmissionsTable } from './TransmissionsTable';
import { TransmitDialog } from './TransmitDialog';
import { useBundle, useBundleDownload, useGenerateBundle, useRecoveryPermissions } from './hooks';
import { isActive, safeZipName, sizeLabel } from './labels';
import type { Bundle, CaseBundleSummary, RecoveryCase } from './model';
import { saveBlob } from '../rent/download';
import { moneyText } from '../rent/labels';
import { DescriptionList, ListLoading, LoadError, errorMessage, useNotify } from '../../locataires/kit';
import { formatDateFr } from '../../locataires/kit/dates';

export function BundlesCard({ recoveryCase }: { recoveryCase: RecoveryCase }) {
  const permissions = useRecoveryPermissions();
  const notify = useNotify();
  const generate = useGenerateBundle();
  const [confirming, setConfirming] = useState(false);
  const editable = permissions.write && isActive(recoveryCase.status);

  const run = async () => {
    try {
      const bundle = await generate.mutateAsync(recoveryCase.id);
      notify({ title: 'Envoi généré', description: `Envoi ${bundle.number} : ${String(bundle.pieces.length)} pièces, ${sizeLabel(bundle.sizeBytes)}.` });
    } catch (error) {
      notify({ tone: 'danger', title: 'Génération impossible', description: errorMessage(error) });
    } finally {
      setConfirming(false);
    }
  };

  return (
    <Card role="region" aria-label="Pièces du dossier" className="gap-3">
      <CardHeader>
        <CardTitle as="h2">Pièces du dossier</CardTitle>
        {editable ? (
          <Button variant="secondary" size="sm" onClick={() => { setConfirming(true); }}>
            <Icon icon={FilePlus2} />
            Générer un envoi de pièces
          </Button>
        ) : null}
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {recoveryCase.bundles.length === 0 ? (
          <EmptyState icon={Package} title="Aucun envoi généré" description="Un envoi réunit le décompte, les avis d’échéance, la fiche du bail et l’extrait du grand livre dans un fichier ZIP." />
        ) : (
          recoveryCase.bundles.map((summary) => <BundleSection key={summary.id} summary={summary} recoveryCase={recoveryCase} editable={editable} />)
        )}
      </CardContent>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title="Générer un envoi de pièces ?"
        description="Le décompte et la liste des pièces sont figés à cet instant : une modification ultérieure ne change pas un envoi déjà généré."
        confirmLabel="Générer l’envoi"
        loading={generate.isPending}
        onConfirm={() => { void run(); }}
      />
    </Card>
  );
}

function BundleSection({ summary, recoveryCase, editable }: { summary: CaseBundleSummary; recoveryCase: RecoveryCase; editable: boolean }) {
  const bundle = useBundle(summary.id);
  if (bundle.isError) return <LoadError title={bundle.error?.message ?? `L’envoi ${summary.number} n’a pas pu être chargé`} />;
  if (!bundle.data) return <ListLoading label={`Chargement de l’envoi ${summary.number}`} />;
  return <BundleDetail bundle={bundle.data} recoveryCase={recoveryCase} editable={editable} />;
}

function BundleDetail({ bundle, recoveryCase, editable }: { bundle: Bundle; recoveryCase: RecoveryCase; editable: boolean }) {
  const notify = useNotify();
  const download = useBundleDownload();
  const [transmitting, setTransmitting] = useState(false);

  const save = async () => {
    try {
      saveBlob(await download.mutateAsync(bundle.id), safeZipName(`Dossier-${recoveryCase.number}-${bundle.number}`));
    } catch (error) {
      notify({ tone: 'danger', title: 'Téléchargement impossible', description: errorMessage(error) });
    }
  };

  return (
    <section aria-label={`Envoi ${bundle.number}`} className="flex flex-col gap-3 rounded-md border border-line p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="text-section-title">{`Envoi ${bundle.number}`}</h3>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" size="sm" loading={download.isPending} onClick={() => { void save(); }}>
            <Icon icon={Download} />
            Télécharger le ZIP
          </Button>
          {editable ? (
            <Button size="sm" onClick={() => { setTransmitting(true); }}>
              <Icon icon={Send} />
              Transmettre au commissaire de justice
            </Button>
          ) : null}
        </div>
      </div>
      <DescriptionList
        termWidth="160px"
        items={[
          { term: 'Généré le', detail: formatDateFr(bundle.generatedOn) },
          { term: 'Total dû figé', detail: moneyText(bundle.totalDue) },
          { term: 'Total appelé', detail: moneyText(bundle.calledTotal) },
          { term: 'Taille', detail: sizeLabel(bundle.sizeBytes) },
        ]}
      />
      <ul aria-label={`Pièces de l’envoi ${bundle.number}`} className="flex flex-col gap-1 text-body">
        {bundle.pieces.map((piece) => (
          <li key={piece.fileName} className="flex flex-wrap justify-between gap-2">
            <span>{piece.label}{piece.number ? ` ${piece.number}` : ''}</span>
            <span className="text-caption text-fg-subtle [overflow-wrap:anywhere]">{piece.fileName}</span>
          </li>
        ))}
      </ul>
      {bundle.transmissions.length === 0 ? (
        <Alert tone="info" title="Pas encore transmis">Aucun lien n’a été envoyé pour cet envoi.</Alert>
      ) : (
        <TransmissionsTable transmissions={bundle.transmissions} editable={editable} />
      )}
      <TransmitDialog bundle={bundle} open={transmitting} onClose={() => { setTransmitting(false); }} />
    </section>
  );
}
