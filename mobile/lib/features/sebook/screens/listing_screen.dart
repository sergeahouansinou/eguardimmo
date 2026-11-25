import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../../core/theme/app_palette.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/widgets/app_button.dart';
import '../../../core/widgets/app_icon_button.dart';
import '../../../core/widgets/async_body.dart';
import '../../../core/widgets/underline_tabs.dart';
import '../../auth/widgets/require_sign_in.dart';
import '../models/listing.dart';
import '../models/listing_enums.dart';
import '../viewmodels/listing_detail_viewmodel.dart';
import '../widgets/favorite_button.dart';
import '../widgets/listing_sections.dart';
import '../widgets/reserve_sheet.dart';
import '../widgets/visit_sheet.dart';

class const ListingScreen({super.key}) extends StatefulWidget {
  @override
  State<ListingScreen> createState() => _ListingScreenState();
}

class _ListingScreenState() extends State<ListingScreen> {
  int _tab = 0;

  Future<void> _visit(ListingDetail listing) async {
    if (!await requireSignIn(context) || !mounted) return;
    await showVisitSheet(context, listingRef: listing.summary.ref);
  }

  Future<void> _reserve(ListingDetail listing) async {
    if (!await requireSignIn(context) || !mounted) return;
    await showReserveSheet(context, listing: listing);
  }

  @override
  Widget build(BuildContext context) {
    final viewModel = context.watch<ListingDetailViewModel>();
    final listing = viewModel.state.dataOrNull;
    return Scaffold(
      appBar: AppBar(
        leading: AppIconButton(
          icon: Icons.arrow_back_rounded,
          tooltip: 'Retour',
          onPressed: () => context.canPop() ? context.pop() : context.go('/'),
        ),
        actions: [
          if (listing != null)
            Padding(
              padding: const EdgeInsets.only(right: AppSpacing.sm),
              child: FavoriteButton(
                listingRef: listing.summary.ref,
                title: listing.summary.title,
              ),
            ),
        ],
      ),
      body: SafeArea(
        child: AsyncBody<ListingDetail>(
          state: viewModel.state,
          onRetry: viewModel.load,
          builder: (context, listing) => ListView(
            padding: const EdgeInsets.all(AppSpacing.screenGutter),
            children: [
              Semantics(
                header: true,
                child: Text(
                  listing.summary.title,
                  style: Theme.of(context).textTheme.headlineSmall,
                ),
              ),
              const SizedBox(height: AppSpacing.xs),
              Text(
                _facts(listing.summary),
                style: Theme.of(context).textTheme.bodyLarge
                    ?.copyWith(color: context.palette.textMuted),
              ),
              const SizedBox(height: AppSpacing.lg),
              if (listing.summary.hostName != null) ...[
                HostCard(name: listing.summary.hostName!),
                const SizedBox(height: AppSpacing.lg),
              ],
              UnderlineTabs(
                labels: const ['Description', 'Conditions'],
                selectedIndex: _tab,
                onChanged: (index) => setState(() => _tab = index),
              ),
              const SizedBox(height: AppSpacing.lg),
              if (_tab == 0)
                ListingDescription(listing: listing)
              else
                ListingConditions(listing: listing),
            ],
          ),
        ),
      ),
      bottomNavigationBar: listing == null
          ? null
          : _ActionBar(
              listing: listing,
              onVisit: () => _visit(listing),
              onReserve: () => _reserve(listing),
            ),
    );
  }

  static String _facts(ListingSummary listing) {
    final parts = [
      ?listing.place,
      '${listing.capacity} voyageur${listing.capacity > 1 ? 's' : ''}',
      if (listing.areaM2 != null) '${listing.areaM2} m²',
      if (listing.rooms != null)
        '${listing.rooms} pièce${listing.rooms! > 1 ? 's' : ''}',
    ];
    return parts.join(' · ');
  }
}

class const _ActionBar({
  required final ListingDetail listing,
  required final VoidCallback onVisit,
  required final VoidCallback onReserve,
}) extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    final theme = Theme.of(context);
    final summary = listing.summary;
    return DecoratedBox(
      decoration: BoxDecoration(
        color: p.surface,
        border: Border(top: BorderSide(color: p.border)),
      ),
      child: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.md),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text.rich(
                TextSpan(
                  children: [
                    TextSpan(
                      text: Formatters.moneyCompact(
                        summary.price.minor,
                        currency: summary.price.currency,
                      ),
                      style: theme.textTheme.titleMedium,
                    ),
                    TextSpan(
                      text: ' ${summary.priceUnit.label}',
                      style: theme.textTheme.bodyMedium?.copyWith(
                        color: p.textMuted,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: AppSpacing.sm),
              Row(
                children: [
                  Expanded(
                    child: AppButton(
                      label: 'Visite',
                      style: AppButtonStyle.outline,
                      onPressed: onVisit,
                    ),
                  ),
                  if (summary.kind == ListingKind.shortStay) ...[
                    const SizedBox(width: AppSpacing.sm),
                    Expanded(
                      child: AppButton(label: 'Réserver', onPressed: onReserve),
                    ),
                  ],
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
