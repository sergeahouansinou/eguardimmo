import 'package:flutter/widgets.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../core/routes/app_routes.dart';
import 'screens/explore_screen.dart';
import 'screens/listing_screen.dart';
import 'screens/stays_screen.dart';
import 'services/marketplace_service.dart';
import 'viewmodels/listing_detail_viewmodel.dart';

List<RouteBase> exploreTabRoutes() => [
  GoRoute(path: AppRoutes.explore, builder: (_, _) => const ExploreScreen()),
];

List<RouteBase> staysTabRoutes() => [
  GoRoute(path: AppRoutes.stays, builder: (_, _) => const StaysScreen()),
];

List<RouteBase> sebookRootRoutes() => [
  GoRoute(
    path: AppRoutes.listingPattern,
    builder: (context, state) => ChangeNotifierProvider(
      key: ValueKey(state.pathParameters['ref']),
      create: (context) => ListingDetailViewModel(
        context.read<MarketplaceService>(),
        state.pathParameters['ref']!,
      )..load(),
      child: const ListingScreen(),
    ),
  ),
];
