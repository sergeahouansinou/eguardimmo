import 'package:flutter/material.dart';

import '../../../core/theme/app_palette.dart';
import '../../../core/theme/app_radius.dart';
import '../../../core/theme/app_spacing.dart';
import '../viewmodels/place_search_viewmodel.dart';

/// Champ « Destination » de l'en-tête (fiche blanche, bouton d'accent).
class const PlaceSearchField({
  super.key,
  required final TextEditingController controller,
  required final ValueChanged<String> onChanged,
  required final VoidCallback onSubmitted,
}) extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    final theme = Theme.of(context);
    return DecoratedBox(
      decoration: BoxDecoration(color: p.surface, borderRadius: AppRadius.card),
      child: Row(
        children: [
          Expanded(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(
                AppSpacing.lg,
                AppSpacing.sm,
                0,
                AppSpacing.sm,
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('DESTINATION', style: theme.textTheme.labelSmall),
                  TextField(
                    controller: controller,
                    onChanged: onChanged,
                    onSubmitted: (_) => onSubmitted(),
                    textInputAction: TextInputAction.search,
                    maxLength: PlaceSearchViewModel.maxLength,
                    style: theme.textTheme.bodyLarge,
                    decoration: InputDecoration(
                      hintText: 'Ville ou code postal, ex. Lyon',
                      counterText: '',
                      isDense: true,
                      filled: false,
                      border: InputBorder.none,
                      enabledBorder: InputBorder.none,
                      focusedBorder: InputBorder.none,
                      contentPadding: const EdgeInsets.symmetric(
                        vertical: AppSpacing.xs,
                      ),
                      hintStyle: TextStyle(color: p.textSubtle),
                    ),
                  ),
                ],
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(AppSpacing.xs),
            child: IconButton(
              tooltip: 'Rechercher',
              onPressed: onSubmitted,
              icon: const Icon(Icons.search_rounded),
              style: IconButton.styleFrom(
                backgroundColor: p.accent,
                foregroundColor: p.onAccent,
                minimumSize: const Size.square(AppSpacing.minTapTarget),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
