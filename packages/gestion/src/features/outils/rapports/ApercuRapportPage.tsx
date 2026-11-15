'use client';

import { useMemo, useState } from 'react';
import { Download, Mail, Printer } from 'lucide-react';
import { Button, Icon } from '@eguardimmo/ui';
import { EmptyBlock, PageHeader, QueryState, Switch } from '../kit';
import type { ScreenProps } from '../kit';
import { downloadCsv } from '../analytique/csv';
import { formatStamp } from '../analytique/format';
import { MODELED_SLUG, reportHref } from './catalog';
import { buildLoyers, decodeFilters, encodeFilters, loyersDataset, scopeLabel } from './loyers';
import type { LoyersView } from './loyers';
import { PaperViewer, printDocument } from './PaperViewer';
import { ReportPaper } from './ReportPaper';
import type { PaperOptions } from './ReportPaper';
import { EmailDialog } from './SendDialogs';
import { useLoyersData } from './source';

export interface ApercuRapportPageProps extends ScreenProps {
  search?: string;
}

export function ApercuRapportPage({ Link, navigate, search = '' }: ApercuRapportPageProps) {
  const query = useLoyersData();
  const filters = useMemo(() => decodeFilters(new URLSearchParams(search)), [search]);
  const view = useMemo(() => (query.data ? buildLoyers(query.data, filters) : null), [query.data, filters]);
  const [options, setOptions] = useState<PaperOptions>({ annex: true, letterhead: true, hideZero: false });
  const [page, setPage] = useState(1);
  const [emailing, setEmailing] = useState(false);
  const title = view ? `Loyers encaissés ${view.period.title}` : 'Loyers encaissés';
  const pages = options.annex ? 2 : 1;
  const current = Math.min(page, pages);
  const backHref = `${reportHref(MODELED_SLUG)}?${encodeFilters(filters)}`;

  return (
    <>
      <PageHeader
        Link={Link}
        crumbs={[{ label: 'Outils' }, { label: 'Rapports', href: '/rapports' }, { label: 'Loyers encaissés', href: backHref }, { label: 'Aperçu PDF' }]}
        title={title}
        description="Aperçu du rapport avant téléchargement ou envoi."
        actions={
          <>
            <Button variant="ghost" onClick={() => { setEmailing(true); }}>
              <Icon icon={Mail} />
              Envoyer par e-mail
            </Button>
            <Button
              variant="secondary"
              disabled={!view?.hasData}
              onClick={() => { if (view) downloadCsv('loyers-encaisses', loyersDataset(view)); }}
            >
              <Icon icon={Download} />
              Exporter en Excel
            </Button>
            <Button disabled={!view?.hasData} onClick={printDocument}>
              <Icon icon={Printer} />
              Télécharger le PDF
            </Button>
          </>
        }
      />
      <QueryState query={query} errorTitle="L’aperçu n’a pas pu être chargé">
        {(data) =>
          view?.hasData ? (
            <div className="grid items-start gap-3 lg:grid-cols-[minmax(0,1fr)_320px]">
              <PaperViewer pages={pages} current={current} onPageChange={setPage}>
                <ReportPaper
                  view={view}
                  scope={scopeLabel(data, filters)}
                  generated={formatStamp(data.generatedAt).replace(', ', ' à ')}
                  options={options}
                  pages={pages}
                  current={current}
                />
              </PaperViewer>
              <Side view={view} options={options} onOptions={setOptions} pages={pages} onEdit={() => { navigate(backHref); }} scope={scopeLabel(data, filters)} />
            </div>
          ) : (
            <EmptyBlock
              title="Aucune donnée à afficher"
              action={
                <Button variant="secondary" size="sm" onClick={() => { navigate(reportHref(MODELED_SLUG)); }}>
                  Modifier les paramètres
                </Button>
              }
            >
              Aucun avis d’échéance ne correspond aux paramètres de ce rapport.
            </EmptyBlock>
          )
        }
      </QueryState>
      <EmailDialog open={emailing} onOpenChange={setEmailing} subject={title} />
    </>
  );
}

function Side({
  view,
  options,
  onOptions,
  pages,
  onEdit,
  scope,
}: {
  view: LoyersView;
  options: PaperOptions;
  onOptions: (next: PaperOptions) => void;
  pages: number;
  onEdit: () => void;
  scope: string;
}) {
  const card = 'flex flex-col gap-2 rounded-lg border border-line bg-surface p-4';
  return (
    <aside className="flex min-w-0 flex-col gap-3">
      <section aria-labelledby="apercu-parametres" className={card}>
        <div className="flex items-center justify-between gap-2">
          <h2 id="apercu-parametres" className="text-block-title">Paramètres</h2>
          <Button variant="ghost" size="sm" onClick={onEdit}>Modifier</Button>
        </div>
        <dl className="grid grid-cols-[104px_1fr] gap-x-2 gap-y-1 text-body">
          <dt className="text-fg-subtle">Période</dt>
          <dd>{view.period.title}</dd>
          <dt className="text-fg-subtle">Biens</dt>
          <dd>{scope}</dd>
          <dt className="text-fg-subtle">Regroupement</dt>
          <dd>{view.groups.some((group) => group.label !== null) ? 'Par immeuble' : 'Aucun'}</dd>
        </dl>
      </section>
      <section aria-labelledby="apercu-options" className={card}>
        <h2 id="apercu-options" className="text-block-title">Options du PDF</h2>
        <Switch label="Détail mensuel en annexe" checked={options.annex} onCheckedChange={(annex) => { onOptions({ ...options, annex }); }} />
        <Switch label="Papier à en-tête" checked={options.letterhead} onCheckedChange={(letterhead) => { onOptions({ ...options, letterhead }); }} />
        <Switch label="Masquer les lignes à zéro" checked={options.hideZero} onCheckedChange={(hideZero) => { onOptions({ ...options, hideZero }); }} />
      </section>
      <section aria-labelledby="apercu-contenu" className={card}>
        <h2 id="apercu-contenu" className="text-block-title">Contenu</h2>
        <dl className="flex flex-col text-body">
          {[
            ['Pages', pages],
            ['Lots', view.totals.lots],
            ['Paiements', view.totals.payments],
          ].map(([label, value]) => (
            <div key={label} className="flex justify-between gap-2 border-t border-line py-1.5 first:border-t-0">
              <dt className="text-fg-muted">{label}</dt>
              <dd className="font-semibold tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>
      </section>
    </aside>
  );
}
