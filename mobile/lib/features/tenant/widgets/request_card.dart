import 'package:flutter/material.dart';

import '../../../core/theme/app_palette.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/widgets/info_card.dart';
import '../../../core/widgets/status_pill.dart';
import '../models/tenant_intervention.dart';

PillTone requestTone(RequestState state) => switch (state) {
  RequestState.reported => PillTone.info,
  RequestState.inProgress => PillTone.warning,
  RequestState.done => PillTone.success,
  RequestState.declined || RequestState.cancelled => PillTone.neutral,
};

class const RequestCard({
  super.key,
  required final TenantIntervention request,
  required final VoidCallback onTap,
}) extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final p = context.palette;
    final visit = request.nextVisit;
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
                label: request.state.label,
                tone: requestTone(request.state),
              ),
              Text(request.reference, style: theme.textTheme.bodySmall),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(request.title, style: theme.textTheme.titleMedium),
          Text(
            [
              ?request.natureLabel,
              'signalée le ${Formatters.dateLong(request.reportedOn)}',
            ].join(' · '),
            style: theme.textTheme.bodyMedium?.copyWith(color: p.textMuted),
          ),
          if (visit != null)
            Text(
              'Visite ${visit.status.label.toLowerCase()} : ${Formatters.dateLong(visit.scheduledOn)}, ${slotLabel(visit.slot)}',
              style: theme.textTheme.bodySmall,
            ),
        ],
      ),
    );
  }
}
