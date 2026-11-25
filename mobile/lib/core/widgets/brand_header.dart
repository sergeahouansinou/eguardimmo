import 'package:flutter/material.dart';

import '../theme/app_palette.dart';
import '../theme/app_spacing.dart';

/// En-tête de marque (fond de navigation, pastille d'accent, action à droite).
class const BrandHeader({
  super.key,
  final Widget? trailing,
  final Widget? child,
}) extends StatelessWidget {
  static const brand = 'SeBook';

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    return ColoredBox(
      color: p.navBackground,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(
          AppSpacing.screenGutter,
          AppSpacing.md,
          AppSpacing.screenGutter,
          AppSpacing.lg,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                ExcludeSemantics(
                  child: Container(
                    width: AppSpacing.md - 1,
                    height: AppSpacing.md - 1,
                    decoration: BoxDecoration(
                      color: p.accent,
                      shape: BoxShape.circle,
                    ),
                  ),
                ),
                const SizedBox(width: AppSpacing.sm),
                Expanded(
                  child: Semantics(
                    header: true,
                    child: Text(
                      brand,
                      style: Theme.of(context).textTheme.titleLarge?.copyWith(
                        color: p.navText,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ),
                ),
                if (trailing != null) Flexible(flex: 2, child: trailing!),
              ],
            ),
            if (child != null) ...[
              const SizedBox(height: AppSpacing.md),
              child!,
            ],
          ],
        ),
      ),
    );
  }
}
