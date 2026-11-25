import 'package:flutter/material.dart';

import '../../../core/theme/app_spacing.dart';
import '../../../core/widgets/brand_header.dart';
import 'profile_menu_button.dart';

/// Page d'accueil d'un profil : en-tête de marque avec le sélecteur de
/// profil, puis une liste défilante rafraîchissable.
class const ProfileHomeScaffold({
  super.key,
  required final List<Widget> children,
  required final Future<void> Function() onRefresh,
}) extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Column(
          children: [
            const BrandHeader(trailing: ProfileMenuButton()),
            Expanded(
              child: RefreshIndicator(
                onRefresh: onRefresh,
                child: ListView.separated(
                  physics: const AlwaysScrollableScrollPhysics(),
                  padding: const EdgeInsets.all(AppSpacing.screenGutter),
                  itemCount: children.length,
                  separatorBuilder: (_, _) =>
                      const SizedBox(height: AppSpacing.md),
                  itemBuilder: (_, index) => children[index],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
