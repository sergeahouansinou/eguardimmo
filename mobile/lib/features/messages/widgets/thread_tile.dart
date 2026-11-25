import 'package:flutter/material.dart';

import '../../../core/theme/app_palette.dart';
import '../../../core/theme/app_radius.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/widgets/status_pill.dart';
import '../models/thread.dart';

class const ThreadTile({
  super.key,
  required final ThreadSummary thread,
  required final DateTime now,
  required final VoidCallback onOpen,
  final String fallbackName = 'Agence',
}) extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    final theme = Theme.of(context);
    final who = [
      thread.counterpartName ?? fallbackName,
      ?thread.reference,
    ].join(' · ');
    final when = Formatters.shortDateTime(thread.lastMessageAt, now: now);
    return Semantics(
      button: true,
      label:
          '${thread.unread ? 'Non lue. ' : ''}${thread.subject}. $who. '
          '${thread.preview}. $when${thread.isClosed ? '. Fermée' : ''}',
      excludeSemantics: true,
      child: Material(
        color: thread.unread ? p.primarySoft : p.surface,
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
                          thread.subject,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: theme.textTheme.titleSmall?.copyWith(
                            fontWeight: thread.unread
                                ? FontWeight.w800
                                : FontWeight.w600,
                          ),
                        ),
                      ),
                      const SizedBox(width: AppSpacing.sm),
                      Text(when, style: theme.textTheme.bodySmall),
                    ],
                  ),
                  const SizedBox(height: AppSpacing.xs),
                  Text(
                    who,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: p.textMuted,
                    ),
                  ),
                  if (thread.preview.isNotEmpty) ...[
                    const SizedBox(height: AppSpacing.xs),
                    Text(
                      thread.preview,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: theme.textTheme.bodyMedium,
                    ),
                  ],
                  if (thread.unread ||
                      thread.isClosed ||
                      thread.hasAttachments ||
                      thread.awaitingReply) ...[
                    const SizedBox(height: AppSpacing.sm),
                    Wrap(
                      spacing: AppSpacing.sm,
                      runSpacing: AppSpacing.xs,
                      crossAxisAlignment: WrapCrossAlignment.center,
                      children: [
                        if (thread.unread)
                          const StatusPill(
                            label: 'Non lue',
                            tone: PillTone.info,
                          ),
                        if (thread.awaitingReply)
                          const StatusPill(
                            label: 'Réponse attendue',
                            tone: PillTone.warning,
                          ),
                        if (thread.isClosed) const StatusPill(label: 'Fermée'),
                        if (thread.hasAttachments)
                          const StatusPill(label: 'Pièce jointe'),
                      ],
                    ),
                  ],
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
