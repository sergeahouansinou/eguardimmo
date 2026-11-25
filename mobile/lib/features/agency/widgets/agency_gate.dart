import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../core/widgets/async_body.dart';
import '../../../core/widgets/brand_header.dart';
import '../../../core/widgets/state_message.dart';
import '../../profiles/models/app_profile.dart';
import '../../profiles/viewmodels/profiles_viewmodel.dart';
import '../../profiles/widgets/profile_menu_button.dart';

class const AgencyGate({
  super.key,
  required final Widget Function(BuildContext context, String organization)
  builder,
}) extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final profiles = context.watch<ProfilesViewModel>();
    return AsyncBody<List<AppProfile>>(
      state: profiles.state,
      onRetry: profiles.load,
      builder: (context, _) {
        final active = profiles.active;
        final organization = active.organization;
        if (active.kind != ProfileKind.agency || organization == null) {
          return const _ChooseAgency();
        }
        return builder(context, organization);
      },
    );
  }
}

class const _ChooseAgency() extends StatelessWidget {
  @override
  Widget build(BuildContext context) => const Column(
    children: [
      BrandHeader(trailing: ProfileMenuButton()),
      Expanded(
        child: StateMessage(
          icon: Icons.business_rounded,
          title: 'Choisissez votre agence',
          message: 'Sélectionnez le profil de votre agence dans le menu « Profil » pour consulter son espace.',
        ),
      ),
    ],
  );
}
