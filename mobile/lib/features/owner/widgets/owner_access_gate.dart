import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../core/state/load_state.dart';
import '../../../core/widgets/async_body.dart';
import '../../../core/widgets/coming_soon.dart';
import '../../profiles/models/app_profile.dart';
import '../../profiles/viewmodels/profiles_viewmodel.dart';
import '../models/owner_access.dart';
import '../viewmodels/owner_access_viewmodel.dart';

class const OwnerAccessGate({
  super.key,
  required final Widget Function(BuildContext context, OwnerAccess access)
  builder,
}) extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final active = context.watch<ProfilesViewModel>().active;
    if (active.kind == ProfileKind.owner && active.organization != null) {
      return const ComingSoon(
        message:
            'Votre espace de propriétaire en nom propre n’est pas encore disponible dans l’application mobile. '
            'Vos données restent accessibles depuis le site.',
      );
    }
    final access = context.watch<OwnerAccessViewModel>();
    if (access.state is Idle<List<OwnerAccess>>) {
      scheduleMicrotask(access.ensureLoaded);
    }
    return AsyncBody<List<OwnerAccess>>(
      state: access.state,
      onRetry: access.load,
      isEmpty: (items) => items.isEmpty,
      emptyMessage: 'Aucun accès propriétaire n’est rattaché à votre compte.',
      emptyTitle: 'Aucun accès propriétaire',
      builder: (context, _) => builder(context, access.selected!),
    );
  }
}
