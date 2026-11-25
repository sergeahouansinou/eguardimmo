import 'package:flutter/material.dart';

import '../../../core/theme/app_spacing.dart';
import '../../../core/widgets/app_button.dart';
import '../../../core/widgets/inline_message.dart';
import '../models/place.dart';
import '../viewmodels/place_search_viewmodel.dart';

class const PlaceSuggestions({
  super.key,
  required final PlaceSearchStatus status,
  required final List<Place> places,
  required final String? failure,
  required final ValueChanged<Place> onSelected,
  required final VoidCallback onRetry,
}) extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return switch (status) {
      PlaceSearchStatus.idle => Padding(
        padding: const EdgeInsets.all(AppSpacing.screenGutter),
        child: Text(
          'Saisissez au moins ${PlaceSearchViewModel.minLength} lettres pour trouver un lieu.',
          style: Theme.of(context).textTheme.bodyMedium,
        ),
      ),
      PlaceSearchStatus.loading => Padding(
        padding: EdgeInsets.all(AppSpacing.xl),
        child: Center(
          child: Semantics(
            label: 'Recherche de lieux en cours',
            child: CircularProgressIndicator(),
          ),
        ),
      ),
      PlaceSearchStatus.failed => Padding(
        padding: const EdgeInsets.all(AppSpacing.screenGutter),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            InlineMessage(message: failure ?? 'Recherche indisponible.'),
            const SizedBox(height: AppSpacing.sm),
            AppButton(
              label: 'Réessayer',
              style: AppButtonStyle.outline,
              onPressed: onRetry,
            ),
          ],
        ),
      ),
      PlaceSearchStatus.results when places.isEmpty => Padding(
        padding: const EdgeInsets.all(AppSpacing.screenGutter),
        child: Text(
          'Aucun lieu ne correspond à cette recherche.',
          style: Theme.of(context).textTheme.bodyMedium,
        ),
      ),
      PlaceSearchStatus.results => Column(
        children: [
          for (final place in places)
            ListTile(
              minTileHeight: AppSpacing.minTapTarget,
              leading: const Icon(Icons.place_outlined),
              title: Text(place.label),
              onTap: () => onSelected(place),
            ),
        ],
      ),
    };
  }
}
