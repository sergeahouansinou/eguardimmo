import 'package:go_router/go_router.dart';

import '../../core/routes/app_routes.dart';
import '../agency/agency_routes.dart';
import '../owner/owner_routes.dart';
import '../tenant/tenant_routes.dart';
import 'models/app_profile.dart';
import 'screens/profile_placeholder_screen.dart';

List<RouteBase> profilesRoutes() => [
  ...tenantRoutes(),
  ...ownerRoutes(),
  ...agencyRoutes(),
  GoRoute(
    path: AppRoutes.profilePattern,
    redirect: (_, state) {
      final kind = ProfileKind.fromSlug(state.pathParameters['kind'] ?? '');
      return (kind == null || kind == ProfileKind.traveler)
          ? AppRoutes.explore
          : null;
    },
    builder: (_, state) => ProfilePlaceholderScreen(
      kind: ProfileKind.fromSlug(state.pathParameters['kind']!)!,
    ),
  ),
];
