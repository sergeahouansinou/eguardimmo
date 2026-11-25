import 'package:flutter/material.dart';

import '../theme/app_spacing.dart';
import 'app_button.dart';
import 'app_sheet.dart';

/// Confirmation d'une action : renvoie true quand l'utilisateur confirme.
Future<bool> confirmAction(
  BuildContext context, {
  required String title,
  required String message,
  required String confirmLabel,
  String keepLabel = 'Conserver',
  bool destructive = true,
}) async {
  final confirmed = await showAppSheet<bool>(
    context,
    builder: (sheetContext) => Semantics(
      scopesRoute: true,
      explicitChildNodes: true,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Semantics(
            header: true,
            child: Text(
              title,
              style: Theme.of(sheetContext).textTheme.titleLarge,
            ),
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(message, style: Theme.of(sheetContext).textTheme.bodyLarge),
          const SizedBox(height: AppSpacing.lg),
          AppButton(
            label: confirmLabel,
            style: destructive ? AppButtonStyle.danger : AppButtonStyle.primary,
            expanded: true,
            onPressed: () => Navigator.of(sheetContext).pop(true),
          ),
          const SizedBox(height: AppSpacing.sm),
          AppButton(
            label: keepLabel,
            style: AppButtonStyle.outline,
            expanded: true,
            onPressed: () => Navigator.of(sheetContext).pop(false),
          ),
        ],
      ),
    ),
  );
  return confirmed ?? false;
}
