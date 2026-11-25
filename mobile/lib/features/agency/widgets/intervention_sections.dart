import 'package:flutter/material.dart';

import '../../../core/theme/app_palette.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/widgets/app_button.dart';
import '../../../core/widgets/info_card.dart';
import '../../../core/widgets/key_value_row.dart';
import '../../../core/widgets/status_pill.dart';
import '../models/agency_intervention.dart';
import '../models/intervention_detail.dart';
import '../models/intervention_parts.dart';
import 'agency_cards.dart';

class const _SectionTitle(final String title) extends StatelessWidget {
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: AppSpacing.sm),
    child: Semantics(
      header: true,
      child: Text(title, style: Theme.of(context).textTheme.titleMedium),
    ),
  );
}

class const InterventionSummaryCard({
  super.key,
  required final InterventionDetail detail,
}) extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final summary = detail.summary;
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
                label: detail.status.label,
                tone: interventionTone(detail.status),
              ),
              if (detail.priority == InterventionPriority.urgent)
                const StatusPill(label: 'Urgente', tone: PillTone.danger),
              Text(summary.reference, style: theme.textTheme.bodySmall),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(summary.title, style: theme.textTheme.titleLarge),
          const SizedBox(height: AppSpacing.xs),
          Text(detail.description, style: theme.textTheme.bodyLarge),
          const SizedBox(height: AppSpacing.sm),
          KeyValueRow(label: 'Lot', value: summary.unitLabel),
          KeyValueRow(
            label: 'Signalée le',
            value: Formatters.dateLong(summary.reportedOn),
          ),
          if (detail.reporterName case final name?)
            KeyValueRow(label: 'Signalée par', value: name),
          KeyValueRow(
            label: 'Responsabilité',
            value: detail.responsibility.label,
          ),
          if (summary.mandantName case final mandant?)
            KeyValueRow(label: 'Propriétaire', value: mandant),
          if (summary.supplierName case final supplier?)
            KeyValueRow(label: 'Prestataire', value: supplier),
          if (detail.dueOn case final due?)
            KeyValueRow(
              label: 'À réaliser avant',
              value: Formatters.dateLong(due),
            ),
          if (summary.estimatedAmount case final amount?)
            KeyValueRow(label: 'Estimation', value: amount.text),
          if (detail.ceiling case final ceiling?)
            KeyValueRow(label: 'Plafond sans accord', value: ceiling.text),
          if (!detail.committed.isZero)
            KeyValueRow(label: 'Engagé', value: detail.committed.text),
          if (detail.declineNote case final note?)
            KeyValueRow(label: 'Motif du refus', value: note),
        ],
      ),
    );
  }
}

class const QuotesCard({
  super.key,
  required final List<InterventionQuote> quotes,
  required final bool canAct,
  required final void Function(InterventionQuote quote) onAccept,
}) extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return InfoCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const _SectionTitle('Devis'),
          for (final quote in quotes)
            Padding(
              padding: const EdgeInsets.only(bottom: AppSpacing.md),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Wrap(
                    spacing: AppSpacing.sm,
                    crossAxisAlignment: WrapCrossAlignment.center,
                    children: [
                      Text(quote.reference, style: theme.textTheme.titleSmall),
                      StatusPill(label: quote.status.label),
                    ],
                  ),
                  KeyValueRow(label: 'Total TTC', value: quote.totalGross.text),
                  if (quote.validUntil case final until?)
                    KeyValueRow(
                      label: 'Valable jusqu’au',
                      value: Formatters.dateLong(until),
                    ),
                  if (quote.message case final message?)
                    Text(message, style: theme.textTheme.bodyMedium),
                  if (canAct && quote.status.acceptable) ...[
                    const SizedBox(height: AppSpacing.sm),
                    AppButton(
                      label: 'Accepter ce devis',
                      expanded: true,
                      onPressed: () => onAccept(quote),
                    ),
                  ],
                ],
              ),
            ),
        ],
      ),
    );
  }
}

class const ApprovalsCard({
  super.key,
  required final InterventionDetail detail,
  required final bool canAct,
  required final void Function(InterventionApproval approval) onRecord,
  required final void Function(InterventionApproval approval) onWithdraw,
}) extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final noProof = detail.availableProofs.isEmpty;
    return InfoCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const _SectionTitle('Accord du propriétaire'),
          for (final approval in detail.approvals)
            Padding(
              padding: const EdgeInsets.only(bottom: AppSpacing.md),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  StatusPill(
                    label: approval.status.label,
                    tone: approval.status.isOpen
                        ? PillTone.warning
                        : PillTone.neutral,
                  ),
                  KeyValueRow(label: 'Montant', value: approval.amount.text),
                  KeyValueRow(
                    label: approval.status.isOpen
                        ? 'À décider avant le'
                        : 'Décision',
                    value: Formatters.dateLong(
                      (approval.status.isOpen
                              ? approval.decideBefore
                              : approval.decidedAt ?? approval.decideBefore)
                          .toLocal(),
                    ),
                  ),
                  if (approval.comment case final comment?)
                    Text(comment, style: theme.textTheme.bodyMedium),
                  if (canAct && approval.status.isOpen) ...[
                    const SizedBox(height: AppSpacing.sm),
                    AppButton(
                      label: 'Enregistrer la décision',
                      expanded: true,
                      onPressed: noProof ? null : () => onRecord(approval),
                    ),
                    if (noProof)
                      Padding(
                        padding: const EdgeInsets.only(top: AppSpacing.xs),
                        child: Text(
                          'Aucune pièce écrite du propriétaire n’est jointe à cette intervention. Le dépôt de pièces n’est pas encore disponible dans l’application.',
                          style: theme.textTheme.bodySmall,
                        ),
                      ),
                    const SizedBox(height: AppSpacing.sm),
                    AppButton(
                      label: 'Retirer la demande d’accord',
                      style: AppButtonStyle.dangerOutline,
                      expanded: true,
                      onPressed: () => onWithdraw(approval),
                    ),
                  ],
                ],
              ),
            ),
        ],
      ),
    );
  }
}

class const TimelineCard({
  super.key,
  required final List<InterventionEvent> events,
  final Widget? footer,
}) extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final muted = theme.textTheme.bodySmall?.copyWith(
      color: context.palette.textMuted,
    );
    return InfoCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const _SectionTitle('Historique'),
          if (events.isEmpty)
            Text(
              'Aucun échange pour le moment.',
              style: theme.textTheme.bodyMedium,
            ),
          for (final event in events.reversed)
            Padding(
              padding: const EdgeInsets.only(bottom: AppSpacing.md),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    '${event.actor.label} · ${Formatters.dateTime(event.createdAt.toLocal())}${_audience(event)}',
                    style: muted,
                  ),
                  Text(event.text, style: theme.textTheme.bodyMedium),
                ],
              ),
            ),
          ?footer,
        ],
      ),
    );
  }

  String _audience(InterventionEvent event) {
    final who = [
      if (event.visibleToTenant) 'locataire',
      if (event.visibleToOwner) 'propriétaire',
    ];
    return who.isEmpty ? '' : ' · visible : ${who.join(', ')}';
  }
}
