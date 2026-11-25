import 'package:flutter/material.dart';

import '../theme/app_palette.dart';
import '../theme/app_radius.dart';
import '../theme/app_spacing.dart';

/// Carte de contenu. Avec [onTap], toute la carte est une cible ≥ 48 pt
/// annoncée comme un bouton.
class const InfoCard({
  super.key,
  required final Widget child,
  final VoidCallback? onTap,
  final String? semanticLabel,
}) extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    final content = Padding(
      padding: const EdgeInsets.all(AppSpacing.md),
      child: child,
    );
    final card = Material(
      color: p.surface,
      shape: RoundedRectangleBorder(
        borderRadius: AppRadius.card,
        side: BorderSide(color: p.border),
      ),
      child: onTap == null
          ? content
          : InkWell(
              borderRadius: AppRadius.card,
              onTap: onTap,
              child: ConstrainedBox(
                constraints: const BoxConstraints(
                  minHeight: AppSpacing.minTapTarget,
                ),
                child: content,
              ),
            ),
    );
    return Semantics(
      container: true,
      button: onTap != null,
      label: semanticLabel,
      child: card,
    );
  }
}
