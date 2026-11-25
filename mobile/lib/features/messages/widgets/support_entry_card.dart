import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/routes/app_routes.dart';
import '../../../core/theme/app_palette.dart';
import '../../../core/theme/app_radius.dart';
import '../../../core/theme/app_spacing.dart';

/// Entrée vers le support de la plateforme : un seul lien, la feature support
/// porte ses propres écrans.
class const SupportEntryCard({super.key}) extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    final theme = Theme.of(context);
    return Semantics(
      button: true,
      label: 'Support eGuardImmo. Une question sur l’application ou votre compte : ouvrez une demande.',
      excludeSemantics: true,
      child: Material(
        color: p.surface,
        shape: RoundedRectangleBorder(
          borderRadius: AppRadius.card,
          side: BorderSide(color: p.border),
        ),
        child: InkWell(
          customBorder: RoundedRectangleBorder(borderRadius: AppRadius.card),
          onTap: () => context.push(AppRoutes.support),
          child: ConstrainedBox(
            constraints: const BoxConstraints(
              minHeight: AppSpacing.minTapTarget,
            ),
            child: Padding(
              padding: const EdgeInsets.all(AppSpacing.md),
              child: Row(
                children: [
                  Icon(Icons.support_agent_rounded, color: p.link),
                  const SizedBox(width: AppSpacing.md),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Support eGuardImmo',
                          style: theme.textTheme.titleSmall,
                        ),
                        Text(
                          'Une question sur l’application ou votre compte ? Ouvrez une demande.',
                          style: theme.textTheme.bodySmall?.copyWith(
                            color: p.textMuted,
                          ),
                        ),
                      ],
                    ),
                  ),
                  Icon(Icons.chevron_right_rounded, color: p.textMuted),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
