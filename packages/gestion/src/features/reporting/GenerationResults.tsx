'use client';

import { Alert, Badge, Card, Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from '@eguardimmo/ui';
import { failureMessage } from './api/reportingErrors';
import type { CreateOutcome } from './model';
import { reportingPaths } from './paths';
import { useGestionNavigation } from '../locataires/kit';

const OUTCOMES = {
  created: { label: 'Créé', tone: 'success' },
  replayed: { label: 'Déjà créé', tone: 'info' },
  failed: { label: 'Échec', tone: 'danger' },
} as const;

export function GenerationResults({ results, names }: { results: readonly CreateOutcome[]; names: ReadonlyMap<string, string> }) {
  const { Link } = useGestionNavigation();
  const failed = results.filter((result) => result.outcome === 'failed').length;
  return (
    <Card role="region" aria-label="Résultat par mandant" className="gap-3">
      <h2 className="text-block-title text-fg">Résultat par mandant</h2>
      {failed > 0 ? (
        <Alert tone="warning" title={`${String(failed)} mandant${failed > 1 ? 's' : ''} en échec`}>
          Les autres comptes rendus ont bien été créés. Corrigez la cause indiquée puis relancez uniquement les mandants en échec.
        </Alert>
      ) : null}
      <Table aria-label="Résultat de la génération">
        <TableHead>
          <TableRow>
            <TableHeaderCell>Mandant</TableHeaderCell>
            <TableHeaderCell>Résultat</TableHeaderCell>
            <TableHeaderCell>Détail</TableHeaderCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {results.map((result) => {
            const outcome = OUTCOMES[result.outcome];
            const name = names.get(result.mandantId) ?? 'Mandant';
            return (
              <TableRow key={result.mandantId}>
                <TableCell strong>{name}</TableCell>
                <TableCell><Badge tone={outcome.tone}>{outcome.label}</Badge></TableCell>
                <TableCell>
                  {result.error ? (
                    failureMessage(result.error)
                  ) : result.report ? (
                    <Link href={reportingPaths.report(result.report.id)} className="text-action-on-subtle underline-offset-2 hover:underline">
                      Ouvrir{' '}<span className="sr-only">{`le compte rendu de ${name}`}</span>
                    </Link>
                  ) : (
                    '—'
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Card>
  );
}
