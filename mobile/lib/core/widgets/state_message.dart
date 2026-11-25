import 'package:flutter/material.dart';

import '../theme/app_palette.dart';
import '../theme/app_spacing.dart';
import 'app_button.dart';

/// Message plein cadre des états vide, erreur et « bientôt disponible ».
class const StateMessage({
  super.key,
  required final String message,
  final String? title,
  final IconData? icon,
  final String? actionLabel,
  final VoidCallback? onAction,
}) extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Center(
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(AppSpacing.xl),
        child: Semantics(
          container: true,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (icon != null) ...[
                ExcludeSemantics(
                  child: Icon(
                    icon,
                    size: AppSpacing.huge,
                    color: context.palette.textSubtle,
                  ),
                ),
                const SizedBox(height: AppSpacing.md),
              ],
              if (title != null) ...[
                Text(
                  title!,
                  textAlign: TextAlign.center,
                  style: theme.textTheme.titleLarge,
                ),
                const SizedBox(height: AppSpacing.sm),
              ],
              Text(
                message,
                textAlign: TextAlign.center,
                style: theme.textTheme.bodyLarge?.copyWith(
                  color: context.palette.textMuted,
                ),
              ),
              if (actionLabel != null && onAction != null) ...[
                const SizedBox(height: AppSpacing.lg),
                AppButton(
                  label: actionLabel!,
                  onPressed: onAction,
                  style: AppButtonStyle.outline,
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
