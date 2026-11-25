import 'package:flutter/material.dart';

import '../theme/app_palette.dart';
import '../theme/app_spacing.dart';

/// Bouton icône : l'info-bulle porte aussi le libellé d'accessibilité.
class const AppIconButton({
  super.key,
  required final IconData icon,
  required final String tooltip,
  required final VoidCallback? onPressed,
  final IconData? selectedIcon,
  final bool? selected,
  final bool onNavigation = false,
}) extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    final foreground = onNavigation ? p.navText : p.text;
    final button = IconButton(
      onPressed: onPressed,
      tooltip: tooltip,
      isSelected: selected,
      icon: Icon(icon),
      selectedIcon: Icon(selectedIcon ?? icon),
      style: IconButton.styleFrom(
        foregroundColor: foreground,
        backgroundColor: onNavigation
            ? p.navText.withValues(alpha: .14)
            : p.surface,
        minimumSize: const Size.square(AppSpacing.minTapTarget),
        side: onNavigation ? null : BorderSide(color: p.borderStrong),
      ),
    );
    return selected == null
        ? button
        : Semantics(toggled: selected, container: true, child: button);
  }
}
