'use client';

import { Alert, Badge, Button, Checkbox, Dialog, DialogContent, Select, TextField } from '@eguardimmo/ui';
import { Download } from 'lucide-react';
import { useState } from 'react';
import { EnergyScale } from '../../components/Charts';
import { DataTable } from '../../components/DataTable';
import { Panel } from '../../components/Panels';
import { QueryBoundary, SkeletonRows } from '../../components/QueryState';
import { useCommand } from '../../hooks/useCommand';
import { useListState } from '../../hooks/useListState';
import { useZodForm } from '../../hooks/useZodForm';
import { formatDate } from '../../lib/dates';
import { downloadFile } from '../../lib/files';
import { DIAGNOSTIC_LABELS } from '../../lib/labels';
import { plural, slugify } from '../../lib/text';
import { useLotDiagnostics } from '../../queries';
import type { Letter } from '../../schemas/common';
import { VALIDITIES, diagnosticFormSchema } from '../../schemas/lots';
import type { Diagnostic } from '../../schemas/lots';

const LETTERS: readonly Letter[] = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
const BANS: { letter: Letter; label: string; date: string }[] = [
  { letter: 'G', label: 'Classe G interdite', date: '2025-01-01' },
  { letter: 'F', label: 'Classe F interdite', date: '2028-01-01' },
  { letter: 'E', label: 'Classe E interdite', date: '2034-01-01' },
];

function AddDialog({ lotId, open, onOpenChange }: { lotId: string; open: boolean; onOpenChange: (open: boolean) => void }) {
  const form = useZodForm(diagnosticFormSchema, { label: '', doneOn: '', validity: '10 ans', result: '' });
  const add = useCommand((source, input: { label: string; doneOn: string; validity: string; result: string }) => source.addDiagnostic(lotId, input), {
    success: (_result, input) => `Diagnostic « ${input.label} » enregistré`,
    onDone: () => {
      form.reset({ label: '', doneOn: '', validity: '10 ans', result: '' });
      onOpenChange(false);
    },
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Ajouter un diagnostic" description="Un diagnostic de même nom est remplacé par le nouveau.">
        <form
          noValidate
          onSubmit={form.submit((values) => { add.execute(values); })}
          className="flex flex-col gap-3 p-4"
        >
          <TextField label="Diagnostic" placeholder="Installation gaz" {...form.field('label')} />
          <TextField label="Réalisé le" type="date" placeholder="2026-11-01" {...form.field('doneOn')} />
          <Select
            label="Validité"
            placeholder="Choisir une durée"
            options={VALIDITIES.map((entry) => ({ value: entry, label: entry }))}
            value={form.values.validity}
            onValueChange={(next) => {
              const validity = VALIDITIES.find((entry) => entry === next);
              if (validity) form.set('validity', validity);
            }}
          />
          <TextField label="Résultat" placeholder="Conforme, aucune anomalie" {...form.field('result')} />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" type="button" onClick={() => { onOpenChange(false); }}>
              Annuler
            </Button>
            <Button type="submit" loading={add.isPending}>
              Enregistrer
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function OrderDialog({ lotId, items, open, onOpenChange }: { lotId: string; items: readonly Diagnostic[]; open: boolean; onOpenChange: (open: boolean) => void }) {
  const [chosen, setChosen] = useState<string[]>(items.map((item) => item.id));
  const order = useCommand((source, ids: string[]) => source.orderDiagnostics(lotId, ids), {
    success: (_result, ids) => plural(ids.length, 'diagnostic commandé', 'diagnostics commandés'),
    onDone: () => { onOpenChange(false); },
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Commander les diagnostics" description="Un diagnostiqueur certifié prendra contact pour fixer un rendez-vous.">
        <div className="flex flex-col gap-2 p-4">
          {items.map((item) => (
            <Checkbox
              key={item.id}
              label={item.label}
              checked={chosen.includes(item.id)}
              onChange={(event) => { setChosen(event.target.checked ? [...chosen, item.id] : chosen.filter((entry) => entry !== item.id)); }}
            />
          ))}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => { onOpenChange(false); }}>
              Annuler
            </Button>
            <Button disabled={chosen.length === 0} loading={order.isPending} onClick={() => { order.execute(chosen); }}>
              Commander
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function LotDiagnostics({ id }: { id: string }) {
  const query = useLotDiagnostics(id);
  const list = useListState(null, 10);
  const [adding, setAdding] = useState(false);
  const [ordering, setOrdering] = useState(false);
  return (
    <QueryBoundary query={query} errorTitle="Les diagnostics n’ont pas pu être chargés" skeleton={<SkeletonRows rows={6} label="Chargement des diagnostics" />}>
      {(data) => {
        const toRedo = data.items.filter((item) => item.status === 'a_refaire' || item.status === 'expire');
        const pending = toRedo.filter((item) => item.orderedOn === null);
        return (
          <>
            {toRedo.length > 0 ? (
              <Alert tone="warning" title={`${plural(toRedo.length, 'diagnostic à refaire', 'diagnostics à refaire')} avant de relouer`}>
                <div className="flex flex-wrap items-center gap-2">
                  <span>{`${toRedo.map((item) => item.label.replace(/ \(.*\)$/, '')).join(' et ')}. Le dossier doit être joint au prochain bail.`}</span>
                  {pending.length > 0 ? (
                    <Button variant="secondary" size="sm" onClick={() => { setOrdering(true); }}>
                      Commander les diagnostics
                    </Button>
                  ) : (
                    <Badge tone="info">Commande en cours</Badge>
                  )}
                </div>
              </Alert>
            ) : null}
            <Panel
              title="Dossier de diagnostic technique"
              action={
                <Button variant="secondary" size="sm" onClick={() => { setAdding(true); }}>
                  Ajouter un diagnostic
                </Button>
              }
            >
              <DataTable
                label="Dossier de diagnostic technique"
                rows={data.items}
                getId={(row) => row.id}
                list={list}
                empty={<p className="text-body text-fg-muted">Aucun diagnostic enregistré pour ce bien.</p>}
                columns={[
                  { id: 'label', header: 'Diagnostic', strong: true, sortBy: (row) => row.label, cell: (row) => row.label },
                  { id: 'doneOn', header: 'Réalisé le', sortBy: (row) => row.doneOn, cell: (row) => (row.doneOn ? formatDate(row.doneOn) : '—') },
                  { id: 'validity', header: 'Validité', cell: (row) => row.validity },
                  { id: 'expiresOn', header: 'Échéance', sortBy: (row) => row.expiresOn, cell: (row) => (row.expiresOn ? formatDate(row.expiresOn) : (row.expiresNote ?? '—')) },
                  {
                    id: 'result',
                    header: 'Résultat',
                    cell: (row) =>
                      row.ratings ? (
                        <span className="inline-flex items-center gap-1">
                          <Badge tone="info">{row.ratings.energy}</Badge>
                          <Badge tone="success">{row.ratings.ghg}</Badge>
                        </span>
                      ) : (
                        row.result
                      ),
                  },
                  {
                    id: 'status',
                    header: 'Statut',
                    sortBy: (row) => DIAGNOSTIC_LABELS[row.status].label,
                    cell: (row) => (
                      <span className="inline-flex items-center gap-1">
                        <Badge tone={DIAGNOSTIC_LABELS[row.status].tone}>{DIAGNOSTIC_LABELS[row.status].label}</Badge>
                        {row.orderedOn ? <Badge tone="info">Commandé</Badge> : null}
                      </span>
                    ),
                  },
                  {
                    id: 'file',
                    header: 'Fichier',
                    cell: (row) =>
                      row.hasFile ? (
                        <Button variant="link" size="sm" onClick={() => { downloadFile(`${slugify(row.label)}.txt`, `Diagnostic de démonstration : ${row.label}\r\n${row.result}\r\n`, 'text/plain;charset=utf-8'); }}>
                          <Download aria-hidden="true" className="size-3.5" />
                          <span className="sr-only">{`Télécharger ${row.label}`}</span>
                        </Button>
                      ) : (
                        '—'
                      ),
                  },
                ]}
              />
            </Panel>
            {data.dpe ? (
              <>
                <Panel title={`Étiquettes énergie, DPE du ${formatDate(data.dpe.date)}`}>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <EnergyScale title="Consommation" letter={data.dpe.energy.letter} value={data.dpe.energy.value} unit={data.dpe.energy.unit} />
                    <EnergyScale title="Émissions" letter={data.dpe.ghg.letter} value={data.dpe.ghg.value} unit={data.dpe.ghg.unit} />
                  </div>
                </Panel>
                <Panel title="Calendrier énergie, loi Climat">
                  <ul aria-label="Calendrier des interdictions de location" className="flex flex-col">
                    {BANS.map((ban) => {
                      const concerned = LETTERS.indexOf(data.dpe?.energy.letter ?? 'A') >= LETTERS.indexOf(ban.letter);
                      return (
                        <li key={ban.letter} className="flex items-center justify-between gap-2 border-b border-line py-2 last:border-b-0">
                          <span>
                            <span className="block text-body font-medium text-fg">{ban.label}</span>
                            <span className="block text-caption text-fg-subtle">{`${ban.date <= data.asOf ? 'Depuis' : 'À partir du'} ${formatDate(ban.date)}`}</span>
                          </span>
                          <Badge tone={concerned ? 'danger' : 'neutral'}>{concerned ? 'Concerné' : 'Non concerné'}</Badge>
                        </li>
                      );
                    })}
                  </ul>
                </Panel>
              </>
            ) : null}
            <AddDialog lotId={id} open={adding} onOpenChange={setAdding} />
            <OrderDialog key={pending.map((item) => item.id).join(',')} lotId={id} items={pending} open={ordering} onOpenChange={setOrdering} />
          </>
        );
      }}
    </QueryBoundary>
  );
}
