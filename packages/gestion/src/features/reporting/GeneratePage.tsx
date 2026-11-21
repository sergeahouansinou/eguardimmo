'use client';

import { Alert, Button, Card, Checkbox, Select, Switch, TextField } from '@eguardimmo/ui';
import { useState } from 'react';
import { GenerationResults } from './GenerationResults';
import { BATCH_MAX } from './api/reportingPayloads';
import { useCreateReports, useMandants } from './hooks';
import { periodKindLabel, plural, sectionLabel } from './labels';
import { PERIOD_KINDS, SECTIONS } from './model';
import type { CreateOutcome, CreateReportsInput, MandantOption, PeriodKind, Section } from './model';
import { reportingPaths } from './paths';
import { ActionError, AgencyGate, ReportingSections } from './parts';
import { useAttemptKey } from '../finances/ownerfunds/attemptKey';
import { ListLoading, LoadError, NoRows, PageHeader, noticeAfterNavigation, useGestionNavigation } from '../locataires/kit';
import { addDays, addMonths, todayIso } from '../locataires/kit/dates';
import { links } from '../locataires/kit/links';

const DEFAULT_SECTIONS: readonly Section[] = ['rent', 'fees', 'payout', 'arrears', 'receipts'];

function defaultPeriod(): { start: string; end: string } {
  const monthStart = `${todayIso().slice(0, 7)}-01`;
  return { start: addMonths(monthStart, -1), end: addDays(monthStart, -1) };
}

const isKind = (value: string): value is PeriodKind => (PERIOD_KINDS as readonly string[]).includes(value);

export function GeneratePage() {
  return (
    <AgencyGate>
      <PageHeader
        crumbs={[{ label: 'Accueil', href: links.home }, { label: 'Comptes rendus', href: reportingPaths.reports }, { label: 'Générer' }]}
        title="Générer les comptes rendus"
        subtitle="Un compte rendu par mandant : les chiffres sont calculés par le serveur à partir du grand livre, rien n’est publié avant votre validation."
      />
      <ReportingSections current="generate" />
      <GenerationForm />
    </AgencyGate>
  );
}

function GenerationForm() {
  const { search, push } = useGestionNavigation();
  const initial = defaultPeriod();
  const mandants = useMandants();
  const create = useCreateReports();
  const keyFor = useAttemptKey();
  const [kind, setKind] = useState<PeriodKind>('monthly');
  const [start, setStart] = useState(search.get('du') ?? initial.start);
  const [end, setEnd] = useState(search.get('au') ?? initial.end);
  const [chosen, setChosen] = useState<ReadonlySet<string>>(() => new Set((search.get('mandants') ?? '').split(',').filter((id) => id !== '')));
  const [sections, setSections] = useState<ReadonlySet<Section>>(new Set(DEFAULT_SECTIONS));
  const [letterhead, setLetterhead] = useState(true);
  const [reminderDetail, setReminderDetail] = useState(false);
  const [notifyMandants, setNotifyMandants] = useState(true);
  const [failure, setFailure] = useState<unknown>(null);
  const [results, setResults] = useState<CreateOutcome[] | null>(null);
  const options: MandantOption[] = mandants.data ?? [];
  const known = new Set(options.map((mandant) => mandant.partyId));
  const selectedIds = [...chosen].filter((id) => known.has(id));

  const toggle = <T,>(current: ReadonlySet<T>, value: T, apply: (next: Set<T>) => void) => {
    const next = new Set(current);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    apply(next);
  };

  const submit = async (generate: boolean) => {
    const input: CreateReportsInput = {
      kind,
      start,
      end,
      mandantIds: selectedIds,
      sections: SECTIONS.filter((section) => sections.has(section)),
      options: { letterhead, reminderDetail, receiptsAttached: false },
      generate,
      notify: notifyMandants,
    };
    setFailure(null);
    setResults(null);
    try {
      const outcomes = await create.mutateAsync({ input, key: keyFor(JSON.stringify(input)) });
      const only = outcomes.length === 1 ? outcomes[0] : undefined;
      if (only?.report && only.outcome !== 'failed') {
        noticeAfterNavigation({ title: generate ? 'Compte rendu généré' : 'Brouillon créé', description: 'Vérifiez-le puis publiez-le.' });
        push(reportingPaths.report(only.report.id));
        return;
      }
      setResults(outcomes);
    } catch (error) {
      setFailure(error);
    }
  };

  return (
    <form
      noValidate
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
      }}
    >
      <Card role="region" aria-label="Période" className="gap-3">
        <h2 className="text-block-title text-fg">Période</h2>
        <div className="grid grid-cols-1 items-end gap-2 sm:grid-cols-3">
          <Select
            label="Type de période"
            placeholder="Type"
            options={PERIOD_KINDS.map((value) => ({ value, label: periodKindLabel[value] }))}
            value={kind}
            onValueChange={(value) => { if (isKind(value)) setKind(value); }}
          />
          <TextField label="Début" type="date" placeholder="AAAA-MM-JJ" value={start} onChange={(event) => { setStart(event.target.value); }} />
          <TextField label="Fin" type="date" placeholder="AAAA-MM-JJ" value={end} onChange={(event) => { setEnd(event.target.value); }} hint="La période doit être terminée et couvrir 12 mois au plus." />
        </div>
      </Card>
      <Card role="region" aria-label="Mandants" className="gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-block-title text-fg">Mandants</h2>
          <span className="text-caption text-fg-subtle" aria-live="polite">{`${plural(selectedIds.length, 'sélectionné', 'sélectionnés')} sur ${String(BATCH_MAX)} au plus`}</span>
        </div>
        {mandants.isError ? <LoadError title={mandants.error?.message ?? 'Les mandants n’ont pas pu être chargés'} /> : null}
        {mandants.isPending && !mandants.isError ? <ListLoading label="Chargement des mandants" /> : null}
        {mandants.data && options.length === 0 ? <NoRows>Aucun mandant : créez d’abord un mandat de gestion.</NoRows> : null}
        {options.length > 0 ? (
          <ul className="grid max-h-80 grid-cols-1 gap-1.5 overflow-auto sm:grid-cols-2">
            {options.map((mandant) => {
              const checked = chosen.has(mandant.partyId);
              return (
                <li key={mandant.partyId}>
                  <Checkbox
                    label={mandant.name}
                    checked={checked}
                    disabled={!checked && selectedIds.length >= BATCH_MAX}
                    onChange={() => { toggle(chosen, mandant.partyId, setChosen); }}
                  />
                </li>
              );
            })}
          </ul>
        ) : null}
      </Card>
      <Card role="region" aria-label="Contenu et options" className="gap-3">
        <h2 className="text-block-title text-fg">Contenu et options</h2>
        <fieldset className="grid min-w-0 grid-cols-1 gap-1.5 border-0 p-0 sm:grid-cols-2">
          <legend className="mb-1 p-0 text-caption text-fg-muted">Sections du compte rendu</legend>
          {SECTIONS.map((section) => (
            <Checkbox key={section} label={sectionLabel[section]} checked={sections.has(section)} onChange={() => { toggle(sections, section, setSections); }} />
          ))}
        </fieldset>
        <div className="flex max-w-md flex-col gap-2">
          <Switch label="Papier à en-tête" checked={letterhead} onCheckedChange={setLetterhead} />
          <Switch label="Détail des relances" checked={reminderDetail} onCheckedChange={setReminderDetail} />
          <Switch label="Prévenir les mandants à la publication" checked={notifyMandants} onCheckedChange={setNotifyMandants} />
        </div>
        <p className="text-caption text-fg-subtle">L’assemblage des quittances jointes n’est pas encore disponible : seule la liste des quittances est incluse.</p>
      </Card>
      {sections.size === 0 ? <Alert tone="warning" title="Aucune section choisie">Choisissez au moins une section du compte rendu.</Alert> : null}
      {failure === null ? null : <ActionError title="Comptes rendus non créés" error={failure} />}
      <div className="flex flex-wrap gap-2">
        <Button loading={create.isPending} disabled={selectedIds.length === 0 || sections.size === 0} onClick={() => { void submit(true); }}>Générer les comptes rendus</Button>
        <Button variant="secondary" loading={create.isPending} disabled={selectedIds.length === 0 || sections.size === 0} onClick={() => { void submit(false); }}>Créer des brouillons</Button>
      </div>
      {results === null ? null : <GenerationResults results={results} names={new Map(options.map((mandant) => [mandant.partyId, mandant.name]))} />}
    </form>
  );
}
