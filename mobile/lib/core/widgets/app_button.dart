import 'package:flutter/material.dart';

import '../theme/app_palette.dart';
import '../theme/app_radius.dart';
import '../theme/app_spacing.dart';

enum AppButtonStyle() {
  primary,
  accent,
  outline,
  ghost,
  danger,
  dangerOutline,
}

class const AppButton({
  super.key,
  required final String label,
  required final VoidCallback? onPressed,
  final AppButtonStyle style = AppButtonStyle.primary,
  final bool loading = false,
  final bool expanded = false,
}) extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    final (background, foreground, border) = switch (style) {
      AppButtonStyle.primary => (p.primary, p.onPrimary, Colors.transparent),
      AppButtonStyle.accent => (p.accent, p.onAccent, Colors.transparent),
      AppButtonStyle.outline => (Colors.transparent, p.text, p.borderStrong),
      AppButtonStyle.ghost => (Colors.transparent, p.link, Colors.transparent),
      AppButtonStyle.danger => (p.danger, p.onDanger, Colors.transparent),
      AppButtonStyle.dangerOutline => (
        Colors.transparent,
        p.onDangerSoft,
        p.onDangerSoft,
      ),
    };
    final button = FilledButton(
      onPressed: loading ? null : onPressed,
      style: FilledButton.styleFrom(
        backgroundColor: background,
        foregroundColor: foreground,
        disabledBackgroundColor: background.withValues(alpha: .5),
        disabledForegroundColor: foreground.withValues(alpha: .6),
        minimumSize: const Size(
          AppSpacing.minTapTarget,
          AppSpacing.minTapTarget,
        ),
        padding: const EdgeInsets.symmetric(horizontal: AppSpacing.xl),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppRadius.pill),
          side: BorderSide(color: border),
        ),
        textStyle: Theme.of(context).textTheme.labelLarge,
      ),
      child: loading
          ? SizedBox.square(
              dimension: AppSpacing.lg,
              child: CircularProgressIndicator(
                strokeWidth: 2,
                color: foreground,
              ),
            )
          : Text(label, textAlign: TextAlign.center),
    );
    return expanded ? SizedBox(width: double.infinity, child: button) : button;
  }
}
