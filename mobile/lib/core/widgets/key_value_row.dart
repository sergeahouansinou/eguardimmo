import 'package:flutter/material.dart';

import '../theme/app_palette.dart';
import '../theme/app_spacing.dart';

class const KeyValueRow({
  super.key,
  required final String label,
  required final String value,
  final bool emphasized = false,
}) extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final muted = theme.textTheme.bodyMedium?.copyWith(
      color: context.palette.textMuted,
    );
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: AppSpacing.xs),
      child: MergeSemantics(
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(flex: 4, child: Text(label, style: muted)),
            const SizedBox(width: AppSpacing.md),
            Expanded(
              flex: 5,
              child: Text(
                value,
                textAlign: TextAlign.end,
                style: emphasized
                    ? theme.textTheme.titleMedium
                    : theme.textTheme.bodyMedium,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
