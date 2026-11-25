import 'package:flutter/material.dart';

import '../theme/app_palette.dart';
import '../theme/app_spacing.dart';

/// Pastille de choix (filtre, onglet de période) : cible ≥ 48, état annoncé.
class const AppChoiceChip({
  super.key,
  required final String label,
  required final bool selected,
  required final VoidCallback onSelected,
  final bool onNavigation = false,
}) extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    final (background, foreground, border) = onNavigation
        ? (
            selected ? p.accent : Colors.transparent,
            selected ? p.onAccent : p.navText,
            selected ? p.accent : p.navText.withValues(alpha: .6),
          )
        : (
            selected ? p.primary : p.surface,
            selected ? p.onPrimary : p.text,
            selected ? p.primary : p.borderStrong,
          );
    return Semantics(
      button: true,
      selected: selected,
      child: Material(
        color: background,
        shape: StadiumBorder(side: BorderSide(color: border)),
        child: InkWell(
          customBorder: const StadiumBorder(),
          onTap: onSelected,
          child: ConstrainedBox(
            constraints: const BoxConstraints(
              minHeight: AppSpacing.minTapTarget,
            ),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg),
              child: Center(
                widthFactor: 1,
                child: Text(
                  label,
                  style: Theme.of(context).textTheme.labelLarge
                      ?.copyWith(color: foreground),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class const ChipRow({super.key, required final List<Widget> children})
    extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      padding: EdgeInsets.zero,
      child: Row(
        children: [
          for (var i = 0; i < children.length; i++) ...[
            if (i > 0) const SizedBox(width: AppSpacing.sm),
            children[i],
          ],
        ],
      ),
    );
  }
}
