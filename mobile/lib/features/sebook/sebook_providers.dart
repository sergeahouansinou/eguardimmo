import 'package:provider/provider.dart';
import 'package:provider/single_child_widget.dart';

import '../../core/services/api_client.dart';
import '../auth/viewmodels/session_viewmodel.dart';
import 'services/bookings_service.dart';
import 'services/marketplace_service.dart';
import 'viewmodels/bookings_viewmodel.dart';
import 'viewmodels/explore_viewmodel.dart';
import 'viewmodels/favorites_viewmodel.dart';
import 'viewmodels/place_search_viewmodel.dart';

List<SingleChildWidget> sebookProviders() => [
  ProxyProvider<ApiClient, MarketplaceService>(
    update: (_, api, _) => MarketplaceService(api),
  ),
  ProxyProvider<ApiClient, BookingsService>(
    update: (_, api, _) => BookingsService(api),
  ),
  ChangeNotifierProxyProvider<MarketplaceService, ExploreViewModel>(
    create: (context) =>
        ExploreViewModel(context.read<MarketplaceService>())..load(),
    update: (_, _, viewModel) => viewModel!,
  ),
  ChangeNotifierProxyProvider<MarketplaceService, PlaceSearchViewModel>(
    create: (context) =>
        PlaceSearchViewModel(context.read<MarketplaceService>()),
    update: (_, _, viewModel) => viewModel!,
  ),
  ChangeNotifierProxyProvider2<
    MarketplaceService,
    SessionViewModel,
    FavoritesViewModel
  >(
    create: (context) => FavoritesViewModel(context.read<MarketplaceService>()),
    update: (_, _, session, viewModel) => viewModel!..bind(session.user?.id),
  ),
  ChangeNotifierProxyProvider2<
    BookingsService,
    SessionViewModel,
    BookingsViewModel
  >(
    create: (context) => BookingsViewModel(context.read<BookingsService>()),
    update: (_, _, session, viewModel) => viewModel!..bind(session.user?.id),
  ),
];
