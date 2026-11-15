'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@eguardimmo/ui';
import { bailOf, resteDu } from './derive';
import { EmptyBlock, FINANCES_ROUTES, LoadingBlock, NotFoundBlock, PageHeader, QueryGate, useExec, useMoney } from './parts';
import type { ScreenProps } from './parts';
import { useFinances } from './queries';
import { financesPaths } from './paths';
import type { FinancesData } from './schemas';
import { creanceKey, dossierOfEcheance } from './recouvrement/creances';
import { OpenDossierFlow } from './recouvrement/OpenDossierFlow';

export function ImpayeDossierPage({ Link, navigate, echeanceId }: ScreenProps & { echeanceId: string }) {
  const query = useFinances();
  return (
    <QueryGate query={query} errorTitle="Le dossier n’a pas pu être chargé">
      {(data) => <ImpayeDossierContent data={data} echeanceId={echeanceId} Link={Link} navigate={navigate} />}
    </QueryGate>
  );
}

function ImpayeDossierContent({ data, echeanceId, Link, navigate }: ScreenProps & { data: FinancesData; echeanceId: string }) {
  const money = useMoney(data.currency);
  const exec = useExec({ navigate });
  const [opening, setOpening] = useState(false);
  const echeance = data.echeances.find((item) => item.id === echeanceId);
  const bail = echeance ? bailOf(data, echeance.bailId) : undefined;
  const dossierId = dossierOfEcheance(data, echeanceId)?.id;
  const redirected = useRef(false);
  useEffect(() => {
    if (!dossierId || redirected.current) return;
    redirected.current = true;
    navigate(financesPaths.dossier(dossierId));
  }, [dossierId, navigate]);

  const crumbs = [{ label: 'Finances', href: FINANCES_ROUTES.operations }, { label: 'Impayés', href: FINANCES_ROUTES.impayes }, { label: 'Recouvrement' }];
  if (dossierId) return <LoadingBlock label="Ouverture du dossier" />;
  if (!echeance || !bail) {
    return (
      <>
        <PageHeader Link={Link} crumbs={crumbs} title="Recouvrement" />
        <NotFoundBlock Link={Link} title="Impayé introuvable" backHref={FINANCES_ROUTES.impayes} backLabel="Retour aux impayés" />
      </>
    );
  }
  const reste = resteDu(echeance);
  return (
    <>
      <PageHeader Link={Link} crumbs={crumbs} title={`Recouvrement, ${bail.locataire}`} description={`${bail.unite}, ${bail.immeuble}`} />
      <EmptyBlock
        title="Aucun dossier de recouvrement"
        action={
          reste > 0 ? (
            <Button onClick={() => { setOpening(true); }}>Ouvrir un dossier</Button>
          ) : null
        }
      >
        {reste > 0 ? `Le dossier regroupe les créances en retard, les relances, les actes et leurs frais. ${money(reste)} restent dus sur cette échéance.` : 'Cette échéance est soldée : aucun dossier à ouvrir.'}
      </EmptyBlock>
      {opening ? (
        <OpenDossierFlow
          data={data}
          bailId={bail.id}
          initial={[creanceKey({ kind: 'echeance', refId: echeanceId })]}
          exec={exec}
          navigate={navigate}
          money={money}
          onClose={() => { setOpening(false); }}
        />
      ) : null}
    </>
  );
}
