import 'package:flutter/material.dart';

import '../theme/app_palette.dart';
import '../theme/app_spacing.dart';
import 'coming_soon.dart';
import 'info_card.dart';

/// Fonctions du profil dont l'API n'est pas encore branchée dans
/// l'application : liste honnête, sans action factice.
class const ComingSoonCard({super.key, required final List<String> items})
    extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return InfoCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Semantics(
            header: true,
            child: Text(ComingSoon.title, style: theme.textTheme.titleMedium),
          ),
          const SizedBox(height: AppSpacing.sm),
          for (final item in items)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: AppSpacing.xs),
              child: Text(
                '· $item',
                style: theme.textTheme.bodyMedium?.copyWith(
                  color: context.palette.textMuted,
                ),
              ),
            ),
        ],
      ),
    );
  }
}
