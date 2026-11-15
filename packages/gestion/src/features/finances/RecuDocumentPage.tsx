'use client';

import { Alert, Button } from '@eguardimmo/ui';
import { RecuSide, RecuSheet } from './documents/RecuDocument';
import { DocumentViewer } from './documents/Viewer';
import { FINANCES_ROUTES, NotFoundBlock, PageHeader, QueryGate, useExec } from './parts';
import type { ScreenProps } from './parts';
import { useFinances } from './queries';
import { formatDate } from './dates';

export function RecuDocumentPage({ Link, navigate, recuId }: ScreenProps & { recuId: string }) {
  const query = useFinances();
  const exec = useExec({ navigate });
  const recu = query.data?.recus.find((item) => item.id === recuId);

  return (
    <>
      <PageHeader
        Link={Link}
        crumbs={[{ label: 'Documents', href: '/documents' }, { label: 'Quittances', href: '/documents/quittances' }, { label: recu?.numero ?? recuId }]}
        title={recu ? `Reçu d’acompte du ${formatDate(recu.date)}` : 'Reçu d’acompte'}
        description="Remis au locataire à la place d’une quittance tant que l’échéance n’est pas soldée."
        actions={
          recu ? (
            <>
              <Button variant="ghost" loading={exec.pending} onClick={() => { exec.run({ type: 'sendReceipt', recuId: recu.id }); }}>
                Renvoyer
              </Button>
              <Button variant="secondary" onClick={() => { window.print(); }}>
                Télécharger
              </Button>
              {recu.resteDu > 0 && recu.echeanceId ? (
                <Button onClick={() => { navigate(`${FINANCES_ROUTES.encaisser}?echeance=${recu.echeanceId ?? ''}`); }}>Enregistrer le solde</Button>
              ) : null}
            </>
          ) : null
        }
      />
      {exec.error ? (
        <Alert tone="danger" title="L’opération n’a pas été enregistrée">
          {exec.error.message}
        </Alert>
      ) : null}
      <QueryGate query={query} errorTitle="Le reçu n’a pas pu être chargé">
        {(data) => {
          const found = data.recus.find((item) => item.id === recuId);
          if (!found) return <NotFoundBlock Link={Link} title="Reçu introuvable" backHref={FINANCES_ROUTES.operations} backLabel="Retour aux finances" />;
          return (
            <DocumentViewer title="Aperçu du PDF" side={<RecuSide data={data} recu={found} />}>
              <RecuSheet data={data} recu={found} />
            </DocumentViewer>
          );
        }}
      </QueryGate>
    </>
  );
}
