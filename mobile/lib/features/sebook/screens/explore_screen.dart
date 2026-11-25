import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../core/routes/app_routes.dart';
import '../../../core/routes/route_args.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/widgets/app_button.dart';
import '../../../core/widgets/app_choice_chip.dart';
import '../../../core/widgets/async_sliver_body.dart';
import '../../../core/widgets/brand_header.dart';
import '../../../core/widgets/inline_message.dart';
import '../../profiles/widgets/profile_menu_button.dart';
import '../models/listing.dart';
import '../models/listing_enums.dart';
import '../models/place.dart';
import '../viewmodels/explore_viewmodel.dart';
import '../viewmodels/place_search_viewmodel.dart';
import '../widgets/listing_card.dart';
import '../widgets/place_search_field.dart';
import '../widgets/place_suggestions.dart';

class const ExploreScreen({super.key}) extends StatefulWidget {
  @override
  State<ExploreScreen> createState() => _ExploreScreenState();
}

class _ExploreScreenState() extends State<ExploreScreen> {
  final _destination = TextEditingController();
  bool _searching = false;

  @override
  void dispose() {
    _destination.dispose();
    super.dispose();
  }

  void _onChanged(String text) {
    setState(() => _searching = text.trim().isNotEmpty);
    context.read<PlaceSearchViewModel>().onChanged(text);
  }

  void _pick(Place? place) {
    context.read<PlaceSearchViewModel>().clear();
    _destination.text = place?.name ?? '';
    setState(() => _searching = false);
    FocusScope.of(context).unfocus();
    unawaited(context.read<ExploreViewModel>().selectPlace(place));
  }

  void _submit() {
    final search = context.read<PlaceSearchViewModel>();
    if (search.status == PlaceSearchStatus.results &&
        search.places.isNotEmpty) {
      _pick(search.places.first);
    }
  }

  @override
  Widget build(BuildContext context) {
    final explore = context.watch<ExploreViewModel>();
    final search = context.watch<PlaceSearchViewModel>();
    final filters = explore.filters;
    return Scaffold(
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: explore.load,
          child: CustomScrollView(
            slivers: [
              SliverToBoxAdapter(
                child: BrandHeader(
                  trailing: const ProfileMenuButton(),
                  child: PlaceSearchField(
                    controller: _destination,
                    onChanged: _onChanged,
                    onSubmitted: _submit,
                  ),
                ),
              ),
              if (_searching)
                SliverToBoxAdapter(
                  child: PlaceSuggestions(
                    status: search.status,
                    places: search.places,
                    failure: search.failure,
                    onSelected: _pick,
                    onRetry: search.retry,
                  ),
                )
              else ...[
                SliverPadding(
                  padding: const EdgeInsets.fromLTRB(
                    AppSpacing.screenGutter,
                    AppSpacing.md,
                    AppSpacing.screenGutter,
                    AppSpacing.sm,
                  ),
                  sliver: SliverToBoxAdapter(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        ChipRow(
                          children: [
                            AppChoiceChip(
                              label: 'Tout',
                              selected: filters.category == null,
                              onSelected: () => explore.selectCategory(null),
                            ),
                            for (final category in ListingCategory.values)
                              AppChoiceChip(
                                label: category.plural,
                                selected: filters.category == category,
                                onSelected: () =>
                                    explore.selectCategory(category),
                              ),
                          ],
                        ),
                        if (filters.place != null) ...[
                          const SizedBox(height: AppSpacing.sm),
                          InputChip(
                            label: Text(filters.place!.label),
                            onDeleted: () => _pick(null),
                            deleteButtonTooltipMessage:
                                'Retirer le lieu : ${filters.place!.name}',
                          ),
                        ],
                        const SizedBox(height: AppSpacing.md),
                        Semantics(
                          header: true,
                          child: Text(
                            filters.place == null && filters.category == null
                                ? 'Séjours à la une'
                                : 'Résultats',
                            style: Theme.of(context).textTheme.titleLarge,
                          ),
                        ),
                        if (explore.state.isLoading &&
                            explore.state.dataOrNull != null)
                          const Padding(
                            padding: EdgeInsets.only(top: AppSpacing.sm),
                            child: LinearProgressIndicator(),
                          ),
                      ],
                    ),
                  ),
                ),
                AsyncSliverBody<ListingPage>(
                  state: explore.state,
                  onRetry: explore.load,
                  emptyTitle: 'Aucune annonce',
                  emptyMessage:
                      'Aucune annonce ne correspond à votre recherche.',
                  isEmpty: (page) => page.items.isEmpty,
                  builder: (context, page) =>
                      _ListingsSliver(page: page, explore: explore),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class const _ListingsSliver({
  required final ListingPage page,
  required final ExploreViewModel explore,
}) extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final extra = (page.hasMore || page.moreFailure != null) ? 1 : 0;
    return SliverPadding(
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.screenGutter,
        0,
        AppSpacing.screenGutter,
        AppSpacing.xl,
      ),
      sliver: SliverList.separated(
        itemCount: page.items.length + extra,
        separatorBuilder: (_, _) => const SizedBox(height: AppSpacing.md),
        itemBuilder: (context, index) {
          if (index < page.items.length) {
            final listing = page.items[index];
            return ListingCard(
              listing: listing,
              onTap: () => Navigator.pushNamed<Object?>(
                context,
                RouteName.listing,
                arguments: ListingArgs(listing.ref),
              ),
            );
          }
          return Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              if (page.moreFailure != null) ...[
                InlineMessage(message: page.moreFailure!),
                const SizedBox(height: AppSpacing.sm),
              ],
              AppButton(
                label: 'Afficher plus d’annonces',
                style: AppButtonStyle.outline,
                loading: page.loadingMore,
                onPressed: explore.loadMore,
              ),
            ],
          );
        },
      ),
    );
  }
}
