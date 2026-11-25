import 'package:flutter/material.dart';

import '../../../core/theme/app_palette.dart';
import '../../../core/theme/app_radius.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/widgets/status_pill.dart';
import '../models/listing.dart';
import 'favorite_button.dart';

class const ListingCard({
  super.key,
  required final ListingSummary listing,
  required final VoidCallback onTap,
}) extends StatelessWidget {
  String? get _subtitle {
    final parts = [?listing.place, ?listing.hostName];
    return parts.isEmpty ? null : parts.join(' · ');
  }

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    final theme = Theme.of(context);
    return DecoratedBox(
      decoration: BoxDecoration(
        color: p.surface,
        borderRadius: AppRadius.card,
        border: Border.all(color: p.border),
      ),
      child: Material(
        type: MaterialType.transparency,
        child: InkWell(
          borderRadius: AppRadius.card,
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.all(AppSpacing.md),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      child: Padding(
                        padding: const EdgeInsets.only(top: AppSpacing.sm),
                        child: Semantics(
                          button: true,
                          label: listing.place == null
                              ? listing.title
                              : '${listing.title}, ${listing.place}',
                          excludeSemantics: true,
                          child: Text(
                            listing.title,
                            style: theme.textTheme.titleMedium,
                          ),
                        ),
                      ),
                    ),
                    FavoriteButton(
                      listingRef: listing.ref,
                      title: listing.title,
                    ),
                  ],
                ),
                const SizedBox(height: AppSpacing.xs),
                if (_subtitle != null) ...[
                  Text(
                    _subtitle!,
                    style: theme.textTheme.bodyMedium?.copyWith(
                      color: p.textMuted,
                    ),
                  ),
                  const SizedBox(height: AppSpacing.sm),
                ],
                Wrap(
                  spacing: AppSpacing.sm,
                  runSpacing: AppSpacing.xs,
                  children: [
                    StatusPill(label: listing.category.singular),
                    StatusPill(
                      label:
                          '${listing.capacity} voyageur${listing.capacity > 1 ? 's' : ''}',
                    ),
                  ],
                ),
                const SizedBox(height: AppSpacing.md),
                Text.rich(
                  TextSpan(
                    children: [
                      TextSpan(
                        text: Formatters.moneyCompact(
                          listing.price.minor,
                          currency: listing.price.currency,
                        ),
                        style: theme.textTheme.titleMedium,
                      ),
                      TextSpan(
                        text: ' ${listing.priceUnit.label}',
                        style: theme.textTheme.bodyMedium?.copyWith(
                          color: p.textMuted,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
