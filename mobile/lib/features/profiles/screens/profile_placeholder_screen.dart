import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../core/widgets/brand_header.dart';
import '../../../core/widgets/coming_soon.dart';
import '../models/app_profile.dart';
import '../viewmodels/profiles_viewmodel.dart';
import '../widgets/profile_menu_button.dart';

/// Écran d'accueil des profils dont l'API mobile n'est pas encore branchée :
/// aucune donnée illustrative, seulement l'état réel.
class const ProfilePlaceholderScreen({
  super.key,
  required final ProfileKind kind,
}) extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final active = context.watch<ProfilesViewModel>().active;
    final label = active.kind == kind ? active.label : kind.title;
    return Scaffold(
      body: SafeArea(
        child: Column(
          children: [
            const BrandHeader(trailing: ProfileMenuButton()),
            Expanded(
              child: ComingSoon(
                message:
                    'L’espace « $label » n’est pas encore disponible dans l’application mobile. '
                    'Vos données restent accessibles depuis le site.',
              ),
            ),
          ],
        ),
      ),
    );
  }
}
