import 'dart:async';

import 'package:dio/dio.dart';

import '../../../core/services/api_exception.dart';
import '../../../core/state/async_view_model.dart';
import '../models/listing.dart';
import '../models/listing_enums.dart';
import '../models/listing_filters.dart';
import '../models/place.dart';
import '../services/marketplace_service.dart';

class ExploreViewModel(final MarketplaceService _service, {super.logger})
    extends AsyncViewModel<ListingPage> {
  ListingFilters _filters = ListingFilters.empty;
  CancelToken? _inFlight;

  ListingFilters get filters => _filters;

  @override
  Future<ListingPage> fetch() {
    _inFlight?.cancel();
    final token = _inFlight = CancelToken();
    return _service.listings(_filters, cancelToken: token);
  }

  Future<void> selectPlace(Place? place) {
    _filters = _filters.withPlace(place);
    return load();
  }

  Future<void> selectCategory(ListingCategory? category) {
    _filters = _filters.withCategory(category);
    return load();
  }

  Future<void> loadMore() async {
    final page = state.dataOrNull;
    if (page == null || !page.hasMore || page.loadingMore || state.isLoading) {
      return;
    }
    replaceData(page.copyWith(loadingMore: true, clearFailure: true));
    try {
      final next = await _service.listings(_filters, after: page.nextCursor);
      replaceData(
        ListingPage(
          items: [...page.items, ...next.items],
          nextCursor: next.nextCursor,
        ),
      );
    } on ApiException catch (error) {
      replaceData(
        page.copyWith(loadingMore: false, moreFailure: error.message),
      );
    } on Exception catch (error, stack) {
      logger.error('Page suivante impossible', error: error, stack: stack);
      replaceData(
        page.copyWith(
          loadingMore: false,
          moreFailure: AsyncViewModel.genericFailure,
        ),
      );
    }
  }

  @override
  void dispose() {
    _inFlight?.cancel();
    super.dispose();
  }
}
