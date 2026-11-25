import 'package:flutter/material.dart';

import '../theme/app_palette.dart';
import '../theme/app_radius.dart';
import '../theme/app_spacing.dart';
import 'status_pill.dart';

/// Bandeau d'information ou d'erreur dans une page ou une feuille.
class const InlineMessage({
  super.key,
  required final String message,
  final PillTone tone = PillTone.danger,
}) extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    final (background, foreground) = switch (tone) {
      PillTone.success => (p.successSoft, p.onSuccessSoft),
      PillTone.warning => (p.warningSoft, p.onWarningSoft),
      PillTone.danger => (p.dangerSoft, p.onDangerSoft),
      PillTone.info || PillTone.neutral => (p.primarySoft, p.onPrimarySoft),
    };
    return Semantics(
      liveRegion: true,
      container: true,
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: background,
          borderRadius: AppRadius.field,
          border: Border.all(color: foreground.withValues(alpha: .4)),
        ),
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.md),
          child: Text(
            message,
            style: Theme.of(context).textTheme.bodyMedium
                ?.copyWith(color: foreground),
          ),
        ),
      ),
    );
  }
}
