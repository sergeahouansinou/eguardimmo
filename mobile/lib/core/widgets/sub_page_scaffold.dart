import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../theme/app_palette.dart';
import '../theme/app_spacing.dart';
import 'app_icon_button.dart';

/// Page secondaire d'un profil : titre, retour (ou repli vers l'accueil du
/// profil quand la page est ouverte sans historique) et contenu.
class const SubPageScaffold({
  super.key,
  required final String title,
  required final String fallbackRoute,
  required final Widget body,
  final Widget? bottom,
}) extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    return Scaffold(
      body: SafeArea(
        child: Column(
          children: [
            ColoredBox(
              color: p.navBackground,
              child: Padding(
                padding: const EdgeInsets.symmetric(
                  horizontal: AppSpacing.screenGutter,
                  vertical: AppSpacing.md,
                ),
                child: Row(
                  children: [
                    AppIconButton(
                      icon: Icons.arrow_back_rounded,
                      tooltip: 'Retour',
                      onNavigation: true,
                      onPressed: () => context.canPop()
                          ? context.pop()
                          : context.go(fallbackRoute),
                    ),
                    const SizedBox(width: AppSpacing.md),
                    Expanded(
                      child: Semantics(
                        header: true,
                        child: Text(
                          title,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: Theme.of(context).textTheme.titleLarge
                              ?.copyWith(
                                color: p.navText,
                                fontWeight: FontWeight.w800,
                              ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
            ?bottom,
            Expanded(child: body),
          ],
        ),
      ),
    );
  }
}
