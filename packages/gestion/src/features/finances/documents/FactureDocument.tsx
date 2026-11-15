import { Badge } from '@eguardimmo/ui';
import { formatDate, formatDateTime } from '../dates';
import { dossierTotals } from '../derive';
import { formatDecimal } from '../money';
import type { Facture, FinancesData } from '../schemas';
import { DataRow, InfoGrid, Legal, Note, SectionRow, SheetHeader, SheetTable, Signature, Strip, Summary, TotalRow } from './Sheet';
import { KeyValues, SealCard, SideCard } from './Viewer';
import type { ReactNode } from 'react';

export function statutBadge(facture: Facture): ReactNode {
  if (facture.type === 'avoir') return <Badge>Avoir</Badge>;
  return facture.statut === 'payee' ? <Badge tone="success">Payée</Badge> : <Badge tone="warning">En attente</Badge>;
}

export function FactureSheet({ data, facture }: { data: FinancesData; facture: Facture }) {
  const bail = data.baux.find((item) => item.id === facture.bailId);
  const dossier = data.dossiers.find((item) => item.id === facture.dossierId);
  const echeance = dossier ? data.echeances.find((item) => item.id === dossier.echeanceId) : undefined;
  const totals = dossier ? dossierTotals(data, dossier) : null;
  const isAvoir = facture.type === 'avoir';
  const kind = isAvoir ? 'AVOIR' : 'FACTURE';
  const tva = facture.montantTtc - facture.montantHt;
  const otherInvoices = dossier
    ? data.factures.filter((item) => item.dossierId === dossier.id && item.id !== facture.id)
    : [];
  const actesRefs = facture.lignes.filter((ligne) => ligne.reference.startsWith('Acte n°'));

  const info: [string, string][] = [
    ['Émetteur', data.workspace.nom],
    ['Destinataire', facture.destinataire],
    ['Objet', facture.objet],
  ];
  if (bail) info.push(['Bien', `${bail.unite}, ${bail.immeuble}`], ['Bail', bail.numero]);
  if (dossier) info.push(['Dossier', dossier.numero]);
  if (facture.echeance) info.push(['Échéance', formatDate(facture.echeance)]);
  info.push(['Règlement', 'Virement bancaire']);

  return (
    <>
      <SheetHeader brand={data.workspace.nom} address={data.workspace.adresse} title={kind} numero={facture.numero} date={`${isAvoir ? 'Émis' : 'Émise'} le ${formatDate(facture.date)}`} seal="Scellé · SHA-256" />
      <InfoGrid items={info} />
      <Strip items={[`${isAvoir ? 'Avoir' : 'Facture'} n° ${facture.numero}`, `Date : ${formatDate(facture.date)}`, facture.echeance ? `À payer avant le ${formatDate(facture.echeance)}` : 'Aucun règlement attendu']} />
      <SheetTable label={`Lignes de ${isAvoir ? 'l’avoir' : 'la facture'}`} headers={[{ label: 'Désignation' }, { label: 'Référence' }, { label: 'Qté', numeric: true }, { label: 'Prix', numeric: true }, { label: 'Montant', numeric: true }]}>
        <SectionRow span={5} tag={dossier ? 'Refacturés au locataire' : undefined}>
          {dossier ? '1 · Frais engagés pour le recouvrement' : '1 · Détail'}
        </SectionRow>
        {facture.lignes.map((ligne, index) => (
          <DataRow
            key={`${ligne.designation}-${String(index)}`}
            cells={[{ value: ligne.designation }, { value: ligne.reference || '—', dim: true }, { value: String(ligne.quantite), numeric: true }, { value: formatDecimal(ligne.prixUnitaire), numeric: true }, { value: formatDecimal(ligne.montant), numeric: true }]}
          />
        ))}
        <TotalRow span={4} label="Total hors TVA" value={formatDecimal(facture.montantHt)} />
        {facture.tvaPct > 0 ? <TotalRow span={4} label={`TVA ${String(facture.tvaPct)} %`} value={formatDecimal(tva)} /> : null}
        {dossier && echeance && totals ? (
          <>
            <SectionRow span={5} tag="Non comprises dans cette facture" tone="danger">
              2 · Autres sommes dues sur le compte
            </SectionRow>
            <DataRow cells={[{ value: `${echeance.libelle}, reste dû` }, { value: '—', dim: true }, { value: '1', numeric: true }, { value: formatDecimal(totals.dette), numeric: true }, { value: formatDecimal(totals.dette), numeric: true }]} />
            {otherInvoices.map((other) => (
              <DataRow
                key={other.id}
                muted={other.statut === 'payee'}
                cells={[{ value: `${other.objet} du ${formatDate(other.date)}` }, { value: other.numero, dim: true }, { value: '1', numeric: true }, { value: formatDecimal(other.montantTtc), numeric: true }, { value: other.statut === 'payee' ? 'Réglé' : formatDecimal(other.montantTtc), numeric: true }]}
              />
            ))}
            <TotalRow span={4} label="Total dû tous comptes" value={formatDecimal(totals.totalARecouvrer)} />
          </>
        ) : null}
        <TotalRow span={4} label={isAvoir ? 'Montant de l’avoir' : 'Montant de la facture'} value={`${formatDecimal(facture.montantTtc)} €`} strong />
      </SheetTable>
      {dossier && totals && actesRefs.length > 0 ? (
        <Note>
          <b>Lecture du calcul :</b> {actesRefs.map((ligne) => `${ligne.reference.toLowerCase()} (${formatDecimal(ligne.montant)})`).join(' + ')} = montant de la facture ({formatDecimal(facture.montantTtc)}). Frais refacturés en application de la clause de recouvrement du bail ; le loyer reste dû séparément : total tous comptes <b>{formatDecimal(totals.totalARecouvrer)} €</b>.
        </Note>
      ) : null}
      {dossier && totals ? (
        <Summary
          title="Dossier de recouvrement"
          items={[
            { label: 'Ouvert le', value: formatDate(dossier.ouvertLe) },
            { label: 'Dette principale', value: formatDecimal(totals.dette), danger: true },
            { label: 'Frais facturés', value: formatDecimal(totals.facturesEnAttente) },
            { label: 'Total à recouvrer', value: formatDecimal(totals.totalARecouvrer), danger: true },
          ]}
        />
      ) : null}
      <Signature place={`Fait à Paris, le ${formatDate(facture.date)}`} brand={data.workspace.nom} />
      <Legal>
        {facture.tvaPct === 0 ? 'Débours non soumis à TVA. ' : ''}Un avoir est émis en cas de remise gracieuse ; une facture émise ne se supprime pas. Document émis et scellé par eGuardImmo ; toute modification invalide son empreinte. À conserver sans limitation de durée.
      </Legal>
    </>
  );
}

export function FactureSide({ data, facture }: { data: FinancesData; facture: Facture }) {
  const dossier = data.dossiers.find((item) => item.id === facture.dossierId);
  return (
    <>
      <SideCard title="Document">
        <KeyValues
          items={[
            ['Numéro', facture.numero],
            ['Destinataire', facture.destinataire],
            ['Objet', facture.objet],
            ['Montant', `${formatDecimal(facture.montantTtc)} €`],
            ['État', statutBadge(facture)],
            ...(facture.envoyeLe ? [['Envoyée le', formatDate(facture.envoyeLe)] as const] : []),
            ...(facture.avoirId ? [['Avoir', data.factures.find((item) => item.id === facture.avoirId)?.numero ?? facture.avoirId] as const] : []),
          ]}
        />
      </SideCard>
      {dossier ? (
        <SideCard title="Pièces jointes">
          <ul className="flex flex-col text-body">
            {['Accusé de réception', 'Commandement de payer', 'Extrait du carnet'].map((name) => (
              <li key={name} className="flex items-center justify-between gap-2 border-t border-line py-1.5 first:border-t-0">
                <span className="text-fg-muted">{name}</span>
                <b className="text-caption text-fg">PDF</b>
              </li>
            ))}
          </ul>
        </SideCard>
      ) : null}
      <SealCard kind="facture" id={facture.id} hash={facture.empreinte} at={formatDateTime(facture.scelleLe)} />
    </>
  );
}
