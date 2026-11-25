import 'package:flutter/material.dart';

import '../../../core/theme/app_palette.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/widgets/info_card.dart';
import '../../../core/widgets/status_pill.dart';
import '../models/agency_intervention.dart';
import '../models/portfolio.dart';
import '../models/unpaid_item.dart';

PillTone interventionTone(InterventionStatus status) => switch (status) {
  InterventionStatus.reported ||
  InterventionStatus.awaitingApproval => PillTone.warning,
  InterventionStatus.completed ||
  InterventionStatus.invoiced ||
  InterventionStatus.closed => PillTone.success,
  InterventionStatus.declined ||
  InterventionStatus.cancelled => PillTone.neutral,
  _ => PillTone.info,
};

PillTone leaseTone(AgencyLeasePhase phase) => switch (phase) {
  AgencyLeasePhase.running => PillTone.success,
  AgencyLeasePhase.notice => PillTone.warning,
  AgencyLeasePhase.ended || AgencyLeasePhase.draft => PillTone.neutral,
  AgencyLeasePhase.upcoming => PillTone.info,
};

String _days(int count) => '$count jour${count > 1 ? 's' : ''}';

class const UnpaidCard({
  super.key,
  required final UnpaidItem item,
  final Widget? footer,
}) extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final muted = theme.textTheme.bodyMedium?.copyWith(
      color: context.palette.textMuted,
    );
    final period = item.periodStart == null || item.periodEnd == null
        ? null
        : Formatters.dateRange(item.periodStart!, item.periodEnd!);
    return InfoCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Wrap(
            spacing: AppSpacing.sm,
            runSpacing: AppSpacing.xs,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              StatusPill(
                label: item.daysOverdue > 0
                    ? '${_days(item.daysOverdue)} de retard'
                    : 'Échu aujourd’hui',
                tone: PillTone.danger,
              ),
              StatusPill(label: item.status.label),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            item.partyName ?? 'Locataire non renseigné',
            style: theme.textTheme.titleMedium,
          ),
          Text(
            [item.kind.label, ?item.reference, item.leaseReference].join(' · '),
            style: muted,
          ),
          if (period != null) Text('Période : $period', style: muted),
          Text('Échéance : ${Formatters.dateLong(item.dueDate)}', style: muted),
          const SizedBox(height: AppSpacing.xs),
          Text(
            'Reste dû ${item.outstanding.text} sur ${item.total.text}',
            style: theme.textTheme.titleSmall,
          ),
          if (item.caseNumber case final number?)
            Text(
              'Dossier de recouvrement $number',
              style: theme.textTheme.bodySmall,
            ),
          if (footer case final widget?) ...[
            const SizedBox(height: AppSpacing.sm),
            widget,
          ],
        ],
      ),
    );
  }
}

class const InterventionCard({
  super.key,
  required final AgencyIntervention intervention,
  final VoidCallback? onTap,
}) extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final muted = theme.textTheme.bodyMedium?.copyWith(
      color: context.palette.textMuted,
    );
    return InfoCard(
      onTap: onTap,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Wrap(
            spacing: AppSpacing.sm,
            runSpacing: AppSpacing.xs,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              StatusPill(
                label: intervention.status.label,
                tone: interventionTone(intervention.status),
              ),
              if (intervention.priority == InterventionPriority.urgent)
                const StatusPill(label: 'Urgente', tone: PillTone.danger),
              Text(intervention.reference, style: theme.textTheme.bodySmall),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(intervention.title, style: theme.textTheme.titleMedium),
          Text(intervention.unitLabel, style: muted),
          Text(
            '${intervention.reportedByTenant ? 'Signalée par le locataire' : 'Créée par l’agence'} le ${Formatters.dateLong(intervention.reportedOn)}',
            style: muted,
          ),
          if (intervention.mandantName case final mandant?)
            Text('Propriétaire : $mandant', style: muted),
          if (intervention.supplierName case final supplier?)
            Text('Prestataire : $supplier', style: muted),
          if (intervention.dueOn case final due?)
            Text(
              'À réaliser avant le ${Formatters.dateLong(due)}',
              style: muted,
            ),
          if (intervention.estimatedAmount case final amount?)
            Text(
              'Estimation : ${amount.text}',
              style: theme.textTheme.bodySmall,
            ),
        ],
      ),
    );
  }
}

class const PropertyCard({super.key, required final AgencyProperty property})
    extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final muted = theme.textTheme.bodyMedium?.copyWith(
      color: context.palette.textMuted,
    );
    return InfoCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(property.name, style: theme.textTheme.titleMedium),
          Text(
            '${property.kind.label} · ${property.activeUnits} lot${property.activeUnits > 1 ? 's' : ''} actif${property.activeUnits > 1 ? 's' : ''}',
            style: muted,
          ),
          Text(property.address.oneLine, style: muted),
        ],
      ),
    );
  }
}

class const LeaseCard({super.key, required final AgencyLease lease})
    extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final muted = theme.textTheme.bodyMedium?.copyWith(
      color: context.palette.textMuted,
    );
    return InfoCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Wrap(
            spacing: AppSpacing.sm,
            runSpacing: AppSpacing.xs,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              StatusPill(
                label: lease.phase.label,
                tone: leaseTone(lease.phase),
              ),
              Text(lease.reference, style: theme.textTheme.bodySmall),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            lease.tenantNames.isEmpty
                ? 'Aucun locataire renseigné'
                : lease.tenantNames.join(', '),
            style: theme.textTheme.titleMedium,
          ),
          if (lease.unitLabel case final unit?) Text(unit, style: muted),
          Text(
            lease.endDate == null
                ? 'Depuis le ${Formatters.dateLong(lease.startsOn)}'
                : 'Du ${Formatters.dateLong(lease.startsOn)} au ${Formatters.dateLong(lease.endDate!)}',
            style: muted,
          ),
        ],
      ),
    );
  }
}
