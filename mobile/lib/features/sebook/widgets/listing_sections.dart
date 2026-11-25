import 'package:flutter/material.dart';

import '../../../core/theme/app_palette.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/utils/formatters.dart';
import '../models/amenity.dart';
import '../models/listing.dart';

class const ListingDescription({
  super.key,
  required final ListingDetail listing,
}) extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(listing.description, style: theme.textTheme.bodyLarge),
        if (listing.summary.amenities.isNotEmpty) ...[
          const SizedBox(height: AppSpacing.lg),
          Text('Équipements', style: theme.textTheme.titleSmall),
          const SizedBox(height: AppSpacing.sm),
          Wrap(
            spacing: AppSpacing.sm,
            runSpacing: AppSpacing.sm,
            children: [
              for (final amenity in listing.summary.amenities)
                Chip(label: Text(Amenities.label(amenity))),
            ],
          ),
        ],
      ],
    );
  }
}

class const ListingConditions({super.key, required final ListingDetail listing})
    extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final lines = [
      if (listing.summary.minNights != null)
        'Séjour minimum : ${listing.summary.minNights} nuit${listing.summary.minNights! > 1 ? 's' : ''}',
      listing.cancellationPolicy.description,
      if (listing.deposit != null)
        'Dépôt de garantie : ${Formatters.moneyCompact(listing.deposit!.minor, currency: listing.deposit!.currency)}',
    ];
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        for (final line in lines)
          Padding(
            padding: const EdgeInsets.only(bottom: AppSpacing.sm),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const ExcludeSemantics(child: Text('•  ')),
                Expanded(
                  child: Text(
                    line,
                    style: Theme.of(context).textTheme.bodyLarge,
                  ),
                ),
              ],
            ),
          ),
      ],
    );
  }
}

class const HostCard({super.key, required final String name})
    extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    final theme = Theme.of(context);
    return DecoratedBox(
      decoration: BoxDecoration(
        color: p.surface,
        borderRadius: BorderRadius.circular(AppSpacing.md),
        border: Border.all(color: p.border),
      ),
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.md),
        child: Semantics(
          container: true,
          label: 'Proposé par $name',
          excludeSemantics: true,
          child: Row(
            children: [
              CircleAvatar(
                backgroundColor: p.primary,
                foregroundColor: p.onPrimary,
                child: Text(_initials(name)),
              ),
              const SizedBox(width: AppSpacing.md),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Proposé par',
                      style: theme.textTheme.bodySmall?.copyWith(
                        color: p.textMuted,
                      ),
                    ),
                    Text(name, style: theme.textTheme.titleSmall),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  static String _initials(String name) {
    final words = name
        .split(RegExp(r'\s+'))
        .where((w) => w.isNotEmpty)
        .toList();
    if (words.isEmpty) return '?';
    final first = words.first[0];
    return (words.length > 1 ? first + words[1][0] : first).toUpperCase();
  }
}
