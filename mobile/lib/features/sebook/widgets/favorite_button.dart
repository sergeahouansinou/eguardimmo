import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../core/widgets/app_icon_button.dart';
import '../../auth/widgets/require_sign_in.dart';
import '../viewmodels/favorites_viewmodel.dart';

class const FavoriteButton({
  super.key,
  required final String listingRef,
  required final String title,
}) extends StatelessWidget {
  Future<void> _toggle(BuildContext context) async {
    final messenger = ScaffoldMessenger.of(context);
    final favorites = context.read<FavoritesViewModel>();
    if (!await requireSignIn(context)) return;
    if (favorites.state.dataOrNull == null) await favorites.load();
    final failure = await favorites.toggle(listingRef);
    if (failure != null) {
      messenger.showSnackBar(SnackBar(content: Text(failure)));
    }
  }

  @override
  Widget build(BuildContext context) {
    final isFavorite = context.select<FavoritesViewModel, bool>(
      (favorites) => favorites.isFavorite(listingRef),
    );
    return AppIconButton(
      icon: Icons.favorite_border_rounded,
      selectedIcon: Icons.favorite_rounded,
      selected: isFavorite,
      tooltip: isFavorite
          ? 'Retirer des favoris : $title'
          : 'Ajouter aux favoris : $title',
      onPressed: () => _toggle(context),
    );
  }
}
