import 'package:flutter/material.dart';

import '../theme/app_palette.dart';
import '../theme/app_spacing.dart';
import 'info_card.dart';

class const NavTile({
  super.key,
  required final IconData icon,
  required final String title,
  required final String subtitle,
  required final VoidCallback onTap,
}) extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    final theme = Theme.of(context);
    return InfoCard(
      onTap: onTap,
      semanticLabel: '$title. $subtitle',
      child: Row(
        children: [
          ExcludeSemantics(child: Icon(icon, color: p.link)),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: theme.textTheme.titleMedium),
                Text(
                  subtitle,
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: p.textMuted,
                  ),
                ),
              ],
            ),
          ),
          ExcludeSemantics(
            child: Icon(Icons.chevron_right_rounded, color: p.textSubtle),
          ),
        ],
      ),
    );
  }
}
