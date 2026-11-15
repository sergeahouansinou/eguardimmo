import { Badge } from '@eguardimmo/ui';
import { addDays, addMonths, formatDate, formatDateTime, monthNameOf } from '../dates';
import { MODE_LABELS } from '../labels';
import { formatDecimal } from '../money';
import type { FinancesData, Recu } from '../schemas';
import { DataRow, InfoGrid, Legal, Note, SectionRow, SheetHeader, SheetTable, Signature, Strip, Summary, TotalRow } from './Sheet';
import { KeyValues, SealCard, SideCard } from './Viewer';

const NATURE_TITLES: Record<Recu['nature'], string> = {
  echeance: 'Paiement partiel',
  acompte_loyer: 'Acompte sur loyer',
  acompte_depot: 'Acompte sur dépôt de garantie',
  autre: 'Encaissement',
};

export function RecuSheet({ data, recu }: { data: FinancesData; recu: Recu }) {
  const bail = data.baux.find((item) => item.id === recu.bailId);
  const echeance = data.echeances.find((item) => item.id === recu.echeanceId);
  const nature = NATURE_TITLES[recu.nature];
  const lastDay = echeance ? addDays(addMonths(`${echeance.echeance.slice(0, 7)}-01`, 1), -1) : null;
  const strip = [
    echeance && lastDay ? `Période : 01 – ${lastDay.slice(8)} ${monthNameOf(echeance.echeance)} ${echeance.echeance.slice(0, 4)}` : 'Hors échéance',
    echeance ? `Échéance : ${formatDate(echeance.echeance)}` : 'Aucune imputation',
    `Reste dû : ${formatDecimal(recu.resteDu)} €`,
  ];
  const month = echeance ? monthNameOf(echeance.echeance) : '';

  return (
    <>
      <SheetHeader brand={data.workspace.nom} address={data.workspace.adresse} title="REÇU D’ACOMPTE" numero={recu.numero} date={`Émis le ${formatDate(recu.date)}`} seal="Scellé · SHA-256" />
      <InfoGrid
        items={[
          ['Bailleur', data.workspace.nom],
          ['Locataire', bail?.locataire ?? '—'],
          ['Adresse', bail?.immeuble ?? '—'],
          ['Bien', bail ? `${bail.unite}, ${bail.immeuble}` : '—'],
          ['N° de bail', bail?.numero ?? '—'],
          ['Nature', nature],
          ['Règlement', MODE_LABELS[recu.mode]],
          ['Référence', recu.reference || '—'],
        ]}
      />
      <Strip items={strip} />
      <SheetTable label="Détail du reçu" headers={[{ label: 'Libellé' }, { label: 'Date' }, { label: 'Mode' }, { label: 'Montant', numeric: true }]}>
        <SectionRow span={4}>1 · Encaissement</SectionRow>
        <DataRow cells={[{ value: echeance ? `${nature} ${month ? `de ${month}` : ''}`.trim() : nature }, { value: formatDate(recu.date), dim: true }, { value: MODE_LABELS[recu.mode], dim: true }, { value: formatDecimal(recu.montant), numeric: true }]} />
        <TotalRow span={3} label="Total encaissé" value={formatDecimal(recu.montant)} />
        {echeance ? (
          <>
            <SectionRow span={4}>2 · Imputation</SectionRow>
            <DataRow cells={[{ value: `Échéance de ${month} ${echeance.echeance.slice(0, 4)}, appelée` }, { value: formatDate(echeance.echeance), dim: true }, { value: '—', dim: true }, { value: formatDecimal(recu.appele), numeric: true }]} />
            <DataRow cells={[{ value: 'Reçu sur cette échéance' }, { value: formatDate(recu.date), dim: true }, { value: '—', dim: true }, { value: formatDecimal(recu.recuSurEcheance), numeric: true }]} />
            <TotalRow span={3} label="Reste dû sur l’échéance" value={formatDecimal(recu.resteDu)} />
          </>
        ) : null}
        <TotalRow span={3} label="Acompte reçu" value={`${formatDecimal(recu.montant)} €`} strong />
      </SheetTable>
      <Note>
        <b>Ce reçu ne vaut pas quittance.</b>{' '}
        {recu.resteDu > 0
          ? `L’échéance n’est pas soldée : il reste ${formatDecimal(recu.resteDu)} € à régler. La quittance sera émise automatiquement dès que le reste dû sera nul.`
          : 'La quittance est émise séparément.'}{' '}
        Un acompte versé avant l’échéance est conservé en crédit et imputé d’abord sur la dette la plus ancienne.
      </Note>
      {echeance ? (
        <Summary
          title={`Échéance de ${month} ${echeance.echeance.slice(0, 4)}`}
          items={[
            { label: 'Appelé', value: formatDecimal(recu.appele) },
            { label: 'Reçu', value: formatDecimal(recu.recuSurEcheance) },
            { label: 'Reste dû', value: formatDecimal(recu.resteDu), danger: recu.resteDu > 0 },
            { label: 'Quittance', value: recu.resteDu > 0 ? 'En attente' : 'À émettre' },
          ]}
        />
      ) : null}
      <Signature place={`Fait à Paris, le ${formatDate(recu.date)}`} brand={data.workspace.nom} />
      <Legal>Reçu d’un paiement partiel ou d’un acompte, sans valeur libératoire pour la part restant due. Document émis et scellé par eGuardImmo ; toute modification invalide son empreinte. À conserver sans limitation de durée.</Legal>
    </>
  );
}

export function RecuSide({ data, recu }: { data: FinancesData; recu: Recu }) {
  const bail = data.baux.find((item) => item.id === recu.bailId);
  return (
    <>
      <SideCard title="Document">
        <KeyValues
          items={[
            ['Numéro', recu.numero],
            ['Locataire', bail?.locataire ?? '—'],
            ['Bien', bail?.unite ?? '—'],
            ['Montant', `${formatDecimal(recu.montant)} €`],
            ['État', recu.resteDu > 0 ? <Badge tone="warning" key="e">Échéance non soldée</Badge> : <Badge tone="success" key="e">Échéance soldée</Badge>],
            ...(recu.envoyeLe ? [['Envoyé le', formatDate(recu.envoyeLe)] as const] : []),
          ]}
        />
      </SideCard>
      <SideCard title="Quittance">
        <span className="text-caption text-fg-subtle">{recu.resteDu > 0 ? `Émise automatiquement quand le reste dû de ${formatDecimal(recu.resteDu)} € sera réglé.` : 'Le reste dû est nul : la quittance peut être émise.'}</span>
      </SideCard>
      <SealCard kind="recu" id={recu.id} hash={recu.empreinte} at={formatDateTime(recu.scelleLe)} />
    </>
  );
}
