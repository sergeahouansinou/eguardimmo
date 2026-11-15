'use client';

import { BookOpen, Download, Mail } from 'lucide-react';
import { useState } from 'react';
import { Badge, Button, Icon, Select, StatCard, Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from '@eguardimmo/ui';
import type { BadgeTone } from '@eguardimmo/ui';
import { downloadCsv } from './csv';
import { formatDate } from './dates';
import { bailOf } from './derive';
import { grandLivreOf } from './grandLivre';
import type { GrandLivre, LivreKind } from './grandLivre';
import { formatMoneyInput } from './money';
import { EmptyBlock, FINANCES_ROUTES, NotFoundBlock, PAGE_SIZE, PageHeader, PagedFooter, QueryGate, useMoney } from './parts';
import type { ScreenProps } from './parts';
import { financesPaths } from './paths';
import { useFinances } from './queries';
import type { FinancesData } from './schemas';

const ALL = 'tous';

const KIND_BADGES: Record<LivreKind, { label: string; tone: BadgeTone }> = {
  echeance: { label: 'Appel', tone: 'info' },
  facture: { label: 'Facture', tone: 'warning' },
  avoir: { label: 'Avoir', tone: 'neutral' },
  paiement: { label: 'Règlement', tone: 'success' },
};

export function GrandLivrePage({ Link, navigate, echeanceId }: ScreenProps & { echeanceId: string }) {
  const query = useFinances();
  return (
    <QueryGate query={query} errorTitle="Le grand livre n’a pas pu être chargé">
      {(data) => <GrandLivreContent data={data} echeanceId={echeanceId} Link={Link} navigate={navigate} />}
    </QueryGate>
  );
}

function GrandLivreContent({ data, echeanceId, Link, navigate }: ScreenProps & { data: FinancesData; echeanceId: string }) {
  const echeance = data.echeances.find((item) => item.id === echeanceId);
  const bail = echeance ? bailOf(data, echeance.bailId) : undefined;
  if (!echeance || !bail) {
    return (
      <>
        <PageHeader Link={Link} crumbs={[{ label: 'Finances', href: FINANCES_ROUTES.operations }, { label: 'Impayés', href: FINANCES_ROUTES.impayes }, { label: 'Grand livre' }]} title="Grand livre" />
        <NotFoundBlock Link={Link} title="Impayé introuvable" backHref={FINANCES_ROUTES.impayes} backLabel="Retour aux impayés" />
      </>
    );
  }
  return <Book data={data} echeanceId={echeanceId} locataireId={bail.locataireId} Link={Link} navigate={navigate} />;
}

function Book({ data, echeanceId, locataireId, Link, navigate }: ScreenProps & { data: FinancesData; echeanceId: string; locataireId: string }) {
  const money = useMoney(data.currency);
  const [bailId, setBailId] = useState(ALL);
  const [page, setPage] = useState(1);
  const full = grandLivreOf(data, locataireId);
  const book = grandLivreOf(data, locataireId, bailId === ALL ? null : bailId);
  const echeance = data.echeances.find((item) => item.id === echeanceId);
  if (!full || !book || !echeance) return null;

  const crumbs = [
    { label: 'Finances', href: FINANCES_ROUTES.operations },
    { label: 'Impayés', href: FINANCES_ROUTES.impayes },
    { label: book.locataire, href: financesPaths.impaye(echeanceId) },
    { label: 'Grand livre' },
  ];
  const visible = book.lignes.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <>
      <PageHeader
        Link={Link}
        crumbs={crumbs}
        title={`Grand livre, ${book.locataire}`}
        description={`Appels, factures, avoirs et règlements du locataire, au ${formatDate(data.today)}. Le solde est cumulé ligne après ligne.`}
        actions={
          <>
            <Button variant="secondary" onClick={() => { exportBook(book, data.today); }}>
              <Icon icon={Download} />
              Exporter en CSV
            </Button>
            <Button variant="secondary" onClick={() => { navigate(financesPaths.relance(echeanceId)); }}>
              <Icon icon={Mail} />
              Préparer une relance
            </Button>
            <Button variant="secondary" onClick={() => { navigate(financesPaths.impaye(echeanceId)); }}>
              Dossier de recouvrement
            </Button>
          </>
        }
      />
      <section aria-label="Totaux du grand livre" className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <StatCard label="Total débit" icon={BookOpen} value={money(book.totalDebit)}>
          <span className="text-caption text-fg-subtle">Appels et factures émis</span>
        </StatCard>
        <StatCard label="Total crédit" value={money(book.totalCredit)}>
          <span className="text-caption text-fg-subtle">Règlements et avoirs</span>
        </StatCard>
        <StatCard label={book.solde > 0 ? 'Solde dû' : 'Solde'} tone={book.solde > 0 ? 'danger' : 'default'} value={money(book.solde)}>
          <span className="text-caption text-fg-subtle">{book.solde > 0 ? 'Débit moins crédit' : book.solde < 0 ? 'Trop perçu à reporter' : 'Compte soldé'}</span>
        </StatCard>
      </section>

      <section aria-label="Écritures du grand livre" className="flex min-w-0 flex-col gap-2 rounded-lg border border-line bg-surface p-4">
        {full.baux.length > 1 ? (
          <div className="w-full sm:w-72">
            <Select
              label="Bail"
              placeholder="Tous les baux"
              options={[{ value: ALL, label: 'Tous les baux' }, ...full.baux.map((bail) => ({ value: bail.id, label: `${bail.numero}, ${bail.unite}` }))]}
              value={bailId}
              onValueChange={(value) => { setBailId(value); setPage(1); }}
            />
          </div>
        ) : null}
        {book.lignes.length === 0 ? (
          <EmptyBlock title="Aucune écriture">Aucun appel, facture ou règlement n’est enregistré pour ce locataire.</EmptyBlock>
        ) : (
          <Table aria-label="Écritures">
            <TableHead>
              <tr>
                <TableHeaderCell>Date</TableHeaderCell>
                <TableHeaderCell>Pièce</TableHeaderCell>
                <TableHeaderCell>Libellé</TableHeaderCell>
                <TableHeaderCell numeric>Débit</TableHeaderCell>
                <TableHeaderCell numeric>Crédit</TableHeaderCell>
                <TableHeaderCell numeric>Solde</TableHeaderCell>
              </tr>
            </TableHead>
            <TableBody>
              {visible.map((ligne) => (
                <TableRow key={ligne.id} selected={ligne.id === echeanceId}>
                  <TableCell>{formatDate(ligne.date)}</TableCell>
                  <TableCell>
                    <Badge tone={KIND_BADGES[ligne.kind].tone}>{KIND_BADGES[ligne.kind].label}</Badge>
                    <span className="block text-caption text-fg-subtle">{ligne.piece}</span>
                  </TableCell>
                  <TableCell strong>
                    {ligne.libelle}
                    {ligne.bien ? <span className="block text-caption font-normal text-fg-subtle">{ligne.bien}</span> : null}
                  </TableCell>
                  <TableCell numeric>{ligne.debit === 0 ? '—' : money(ligne.debit)}</TableCell>
                  <TableCell numeric>{ligne.credit === 0 ? '—' : money(ligne.credit)}</TableCell>
                  <TableCell numeric className={ligne.solde > 0 ? 'font-semibold text-fg-danger' : 'font-semibold'}>{money(ligne.solde)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        <PagedFooter page={page} total={book.lignes.length} onPageChange={setPage} label="Pagination des écritures" />
      </section>
    </>
  );
}

function exportBook(book: GrandLivre, today: string) {
  downloadCsv(`grand-livre-${book.locataireId}-${today}.csv`, [
    ['Date', 'Type', 'Pièce', 'Libellé', 'Bien', 'Débit', 'Crédit', 'Solde'],
    ...book.lignes.map((ligne) => [formatDate(ligne.date), KIND_BADGES[ligne.kind].label, ligne.piece, ligne.libelle, ligne.bien, formatMoneyInput(ligne.debit), formatMoneyInput(ligne.credit), formatMoneyInput(ligne.solde)]),
    ['', '', '', 'Total', '', formatMoneyInput(book.totalDebit), formatMoneyInput(book.totalCredit), formatMoneyInput(book.solde)],
  ]);
}
