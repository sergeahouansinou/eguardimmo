import 'package:flutter/material.dart';

import '../theme/app_palette.dart';
import '../theme/app_radius.dart';
import '../theme/app_spacing.dart';

enum PillTone() {
  neutral,
  info,
  success,
  warning,
  danger,
}

class const StatusPill({
  super.key,
  required final String label,
  final PillTone tone = PillTone.neutral,
}) extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    final (background, foreground) = switch (tone) {
      PillTone.neutral => (p.surfaceMuted, p.textMuted),
      PillTone.info => (p.primarySoft, p.onPrimarySoft),
      PillTone.success => (p.successSoft, p.onSuccessSoft),
      PillTone.warning => (p.warningSoft, p.onWarningSoft),
      PillTone.danger => (p.dangerSoft, p.onDangerSoft),
    };
    return DecoratedBox(
      decoration: BoxDecoration(
        color: background,
        borderRadius: AppRadius.badge,
        border: Border.all(color: foreground.withValues(alpha: .35)),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.sm,
          vertical: AppSpacing.xxs,
        ),
        child: Text(
          label,
          style: Theme.of(context).textTheme.labelSmall
              ?.copyWith(color: foreground, fontWeight: FontWeight.w700),
        ),
      ),
    );
  }
}
