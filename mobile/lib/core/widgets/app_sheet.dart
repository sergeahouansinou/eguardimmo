import 'package:flutter/material.dart';

import '../theme/app_motion.dart';
import '../theme/app_palette.dart';
import '../theme/app_radius.dart';
import '../theme/app_spacing.dart';

/// Feuille modale unique du projet. `useRootNavigator: true` : la feuille se
/// pose au-dessus de toute barre d'onglets et assombrit tout l'écran.
Future<T?> showAppSheet<T>(
  BuildContext context, {
  required WidgetBuilder builder,
  bool isDismissible = true,
  bool enableDrag = true,
}) {
  return showModalBottomSheet<T>(
    context: context,
    isScrollControlled: true,
    useRootNavigator: true,
    isDismissible: isDismissible,
    enableDrag: enableDrag,
    backgroundColor: Colors.transparent,
    barrierColor: context.palette.overlay,
    elevation: 0,
    sheetAnimationStyle: const AnimationStyle(
      duration: AppMotion.slow,
      reverseDuration: AppMotion.slow,
      curve: AppMotion.standard,
      reverseCurve: AppMotion.standard,
    ),
    builder: (sheetContext) => AppSheet(child: builder(sheetContext)),
  );
}

class const AppSheet({super.key, required final Widget child})
    extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    final media = MediaQuery.of(context);
    return ConstrainedBox(
      constraints: BoxConstraints(maxHeight: media.size.height * .88),
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: p.surface,
          borderRadius: AppRadius.sheet,
        ),
        child: Material(
          type: MaterialType.transparency,
          child: SingleChildScrollView(
            padding: EdgeInsets.fromLTRB(
              AppSpacing.xl,
              AppSpacing.md,
              AppSpacing.xl,
              AppSpacing.huge + media.viewInsets.bottom,
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Center(
                  child: SizedBox(
                    width: AppSpacing.huge - AppSpacing.sm,
                    height: AppSpacing.xs + 1,
                    child: DecoratedBox(
                      decoration: BoxDecoration(
                        color: p.borderStrong,
                        borderRadius: BorderRadius.circular(AppRadius.pill),
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: AppSpacing.lg),
                child,
              ],
            ),
          ),
        ),
      ),
    );
  }
}
