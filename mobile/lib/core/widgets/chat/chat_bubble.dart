import 'package:flutter/material.dart';

import '../../theme/app_palette.dart';
import '../../theme/app_radius.dart';
import '../../theme/app_spacing.dart';
import '../../utils/formatters.dart';

/// Bulle de message. Le contenu est toujours du texte brut : aucun HTML, aucun
/// Markdown ni aucun lien n'est interprété.
class const ChatBubble({
  super.key,
  required final String author,
  required final String body,
  required final DateTime sentAt,
  required final bool mine,
  final String? footnote,
  final List<Widget> attachments = const [],
}) extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    final theme = Theme.of(context);
    final time = Formatters.dateTime(sentAt.toLocal());
    return Align(
      alignment: mine ? Alignment.centerRight : Alignment.centerLeft,
      child: ConstrainedBox(
        constraints: BoxConstraints(
          maxWidth: MediaQuery.sizeOf(context).width * .86,
        ),
        child: Semantics(
          container: true,
          label: '$author, $time',
          child: DecoratedBox(
            decoration: BoxDecoration(
              color: mine ? p.primarySoft : p.surfaceMuted,
              borderRadius: AppRadius.card,
              border: Border.all(color: p.border),
            ),
            child: Padding(
              padding: const EdgeInsets.all(AppSpacing.md),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    author,
                    style: theme.textTheme.labelLarge?.copyWith(
                      color: mine ? p.onPrimarySoft : p.text,
                    ),
                  ),
                  const SizedBox(height: AppSpacing.xs),
                  Text(body, style: theme.textTheme.bodyLarge),
                  if (attachments.isNotEmpty) ...[
                    const SizedBox(height: AppSpacing.sm),
                    Wrap(
                      spacing: AppSpacing.sm,
                      runSpacing: AppSpacing.sm,
                      children: attachments,
                    ),
                  ],
                  const SizedBox(height: AppSpacing.xs),
                  Text(
                    footnote == null ? time : '$time · $footnote',
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: p.textMuted,
                    ),
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
