import 'package:flutter/widgets.dart';
import 'package:provider/provider.dart';

import '../../core/routes/app_routes.dart';
import '../../core/routes/route_args.dart';
import '../../core/routes/route_error_screen.dart';
import 'screens/explore_screen.dart';
import 'screens/listing_screen.dart';
import 'screens/stays_screen.dart';
import 'services/marketplace_service.dart';
import 'viewmodels/listing_detail_viewmodel.dart';

Widget exploreTab() => const ExploreScreen();

Widget staysTab() => const StaysScreen();

Widget? sebookPage(String? name, Object? arguments) => switch (name) {
  RouteName.listing => switch (arguments) {
    final ListingArgs args when args.isValid => _listing(args.ref),
    _ => const RouteErrorScreen(),
  },
  _ => null,
};

Widget _listing(String ref) => ChangeNotifierProvider(
  key: ValueKey(ref),
  create: (context) =>
      ListingDetailViewModel(context.read<MarketplaceService>(), ref)..load(),
  child: const ListingScreen(),
);
