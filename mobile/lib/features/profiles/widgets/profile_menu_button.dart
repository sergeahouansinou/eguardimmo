import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../../core/routes/app_routes.dart';
import '../../../core/state/load_state.dart';
import '../../../core/theme/app_palette.dart';
import '../../../core/theme/app_radius.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/widgets/app_button.dart';
import '../../../core/widgets/app_sheet.dart';
import '../../../core/widgets/inline_message.dart';
import '../../auth/viewmodels/session_viewmodel.dart';
import '../../auth/widgets/require_sign_in.dart';
import '../models/app_profile.dart';
import '../viewmodels/profiles_viewmodel.dart';

/// Bouton « Profil : … » de l'en-tête. Déconnecté, il propose la connexion.
class const ProfileMenuButton({super.key}) extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final signedIn = context.watch<SessionViewModel>().isSignedIn;
    final p = context.palette;
    if (!signedIn) {
      return TextButton(
        onPressed: () => requireSignIn(context),
        style: _style(p),
        child: const Text('Se connecter'),
      );
    }
    final active = context.watch<ProfilesViewModel>().active;
    return TextButton(
      onPressed: () => _openMenu(context),
      style: _style(p),
      child: Text('Profil : ${active.label}', overflow: TextOverflow.ellipsis),
    );
  }

  ButtonStyle _style(AppPalette p) => TextButton.styleFrom(
    foregroundColor: p.navText,
    backgroundColor: p.navText.withValues(alpha: .14),
    minimumSize: const Size(0, AppSpacing.minTapTarget),
    padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg),
    shape: RoundedRectangleBorder(
      borderRadius: BorderRadius.circular(AppRadius.pill),
    ),
  );

  Future<void> _openMenu(BuildContext context) {
    final viewModel = context.read<ProfilesViewModel>();
    final router = GoRouter.of(context);
    return showAppSheet<void>(
      context,
      builder: (sheetContext) => ChangeNotifierProvider.value(
        value: viewModel,
        child: _ProfileSheet(
          onSelected: (profile) {
            viewModel.select(profile);
            Navigator.of(sheetContext).pop();
            router.go(
              profile.kind == ProfileKind.traveler
                  ? AppRoutes.explore
                  : AppRoutes.profile(profile.kind.slug),
            );
          },
        ),
      ),
    );
  }
}

class const _ProfileSheet({required final ValueChanged<AppProfile> onSelected})
    extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final viewModel = context.watch<ProfilesViewModel>();
    final p = context.palette;
    final failure = switch (viewModel.state) {
      Failed<List<AppProfile>>(:final message) => message,
      _ => null,
    };
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          'Changer de profil',
          style: Theme.of(context).textTheme.titleLarge,
        ),
        const SizedBox(height: AppSpacing.md),
        for (final profile in viewModel.profiles)
          Semantics(
            button: true,
            selected: profile.id == viewModel.active.id,
            child: ListTile(
              minTileHeight: AppSpacing.minTapTarget,
              title: Text(
                profile.label,
                style: Theme.of(context).textTheme.labelLarge,
              ),
              subtitle: profile.label == profile.kind.title
                  ? null
                  : Text(profile.kind.title),
              trailing: profile.id == viewModel.active.id
                  ? Icon(Icons.check_rounded, color: p.link)
                  : null,
              onTap: () => onSelected(profile),
            ),
          ),
        if (failure != null) ...[
          const SizedBox(height: AppSpacing.md),
          InlineMessage(
            message: 'Vos autres profils n’ont pas pu être chargés. $failure',
          ),
          const SizedBox(height: AppSpacing.sm),
          AppButton(
            label: 'Réessayer',
            style: AppButtonStyle.outline,
            onPressed: viewModel.load,
          ),
        ],
      ],
    );
  }
}
