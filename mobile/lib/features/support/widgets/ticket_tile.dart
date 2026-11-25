import 'package:flutter/material.dart';

import '../../../core/theme/app_palette.dart';
import '../../../core/theme/app_radius.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/widgets/status_pill.dart';
import '../models/support_enums.dart';
import '../models/ticket.dart';

PillTone ticketTone(TicketStatus status) => switch (status) {
  TicketStatus.open => PillTone.info,
  TicketStatus.waiting => PillTone.warning,
  TicketStatus.resolved => PillTone.success,
};

class const TicketTile({
  super.key,
  required final TicketSummary ticket,
  required final DateTime now,
  required final VoidCallback onOpen,
}) extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    final theme = Theme.of(context);
    final when = Formatters.shortDateTime(ticket.updatedAt, now: now);
    return Semantics(
      button: true,
      label:
          '${ticket.subject}. ${ticket.reference}. ${ticket.status.label}. '
          '${ticket.category.label}. $when',
      excludeSemantics: true,
      child: Material(
        color: p.surface,
        shape: RoundedRectangleBorder(
          borderRadius: AppRadius.card,
          side: BorderSide(color: p.border),
        ),
        child: InkWell(
          customBorder: RoundedRectangleBorder(borderRadius: AppRadius.card),
          onTap: onOpen,
          child: ConstrainedBox(
            constraints: const BoxConstraints(
              minHeight: AppSpacing.minTapTarget,
            ),
            child: Padding(
              padding: const EdgeInsets.all(AppSpacing.md),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Expanded(
                        child: Text(
                          ticket.subject,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: theme.textTheme.titleSmall,
                        ),
                      ),
                      const SizedBox(width: AppSpacing.sm),
                      Text(when, style: theme.textTheme.bodySmall),
                    ],
                  ),
                  const SizedBox(height: AppSpacing.xs),
                  Text(
                    '${ticket.reference} · ${ticket.category.label}',
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: p.textMuted,
                    ),
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  StatusPill(
                    label: ticket.status.label,
                    tone: ticketTone(ticket.status),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
