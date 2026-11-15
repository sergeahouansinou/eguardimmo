import { ConsoleError, restoreRequestInputSchema, sauvegardesSchema } from '../../schemas';
import { RESTORE_SCOPE_LABELS, RESTORE_TARGET_LABELS } from '../../schemas';
import type { SauvegardesApi } from '../../source';
import { requireFound } from '../context';
import type { DemoContext } from '../context';
import { BACKUP_TESTS } from '../ops';

export function sauvegardesApi(ctx: DemoContext): SauvegardesApi {
  return {
    get: () => {
      const latest = requireFound(ctx.state.backups[0], 'Sauvegarde');
      return Promise.resolve(
        sauvegardesSchema.parse({
          latest,
          total: 42,
          retentionDays: ctx.state.general.backupRetentionDays,
          usedGb: 1180,
          quotaGb: 2000,
          backups: ctx.state.backups,
          tests: BACKUP_TESTS,
          lastTest: { on: '2026-11-05', durationMinutes: 22 },
          nextTestOn: '2027-02-05',
          runbook: 'RUN-07',
          requests: ctx.state.restores,
        }),
      );
    },

    requestRestore: (rawInput) => {
      const input = restoreRequestInputSchema.parse(rawInput);
      const backup = requireFound(ctx.state.backups.find((candidate) => candidate.id === input.backupId), 'Sauvegarde');
      const validator = requireFound(ctx.state.operators.find((operator) => operator.id === input.validatorId), 'Validateur');
      if (validator.self) throw new ConsoleError('invalid', 'Le second validateur doit être un autre opérateur.');
      if (validator.state !== 'actif') throw new ConsoleError('invalid', 'Le second validateur doit être un opérateur actif.');
      if (input.confirmation !== backup.name) throw new ConsoleError('invalid', 'Le nom saisi ne correspond pas à la sauvegarde à restaurer.');
      const id = `restauration-${String(ctx.state.restores.length + 1).padStart(3, '0')}`;
      ctx.state.restores.unshift({
        id,
        backupId: backup.id,
        backupName: backup.name,
        scope: input.scope,
        target: input.target,
        reason: input.reason,
        ticket: input.ticket === '' ? null : input.ticket,
        requestedBy: 'Lucas Bernard',
        validator: validator.name,
        requestedAt: ctx.clock().toISOString(),
        state: 'en_attente',
      });
      ctx.audit.record({
        type: 'sauvegarde',
        title: `Restauration demandée, ${backup.name}`,
        context: `${RESTORE_TARGET_LABELS[input.target]}, ${RESTORE_SCOPE_LABELS[input.scope]}, validation par ${validator.name}`,
        action: 'Demande de restauration',
        module: 'Sauvegardes',
        request: 'POST /api/console/sauvegardes/restaurations',
        after: { Sauvegarde: backup.name, Cible: RESTORE_TARGET_LABELS[input.target], Motif: input.reason, Validateur: validator.name },
      });
      return Promise.resolve({ id });
    },
  };
}
