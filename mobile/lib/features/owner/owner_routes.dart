import 'package:flutter/widgets.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../profiles/widgets/profile_route_gate.dart';
import 'models/owner_access.dart';
import 'owner_paths.dart';
import 'screens/owner_documents_screen.dart';
import 'screens/owner_home_screen.dart';
import 'screens/payouts_screen.dart';
import 'screens/properties_screen.dart';
import 'screens/statement_screen.dart';
import 'services/owner_service.dart';
import 'viewmodels/owner_home_viewmodel.dart';
import 'viewmodels/owner_lists_viewmodels.dart';
import 'viewmodels/owner_statement_viewmodel.dart';
import 'widgets/owner_access_gate.dart';

Widget _page<T extends ChangeNotifier>({
  required T Function(OwnerService service, OwnerAccess access) create,
  required Widget child,
}) => ProfileRouteGate(
  builder: (_) => OwnerAccessGate(
    builder: (_, access) => ChangeNotifierProvider<T>(
      key: ValueKey(access.accessId),
      create: (c) => create(c.read<OwnerService>(), access),
      child: child,
    ),
  ),
);

List<RouteBase> ownerRoutes() => [
  GoRoute(
    path: OwnerPaths.home,
    builder: (_, _) => _page(
      create: (service, access) =>
          OwnerHomeViewModel(service, access.agencyId)..load(),
      child: const OwnerHomeScreen(),
    ),
    routes: [
      GoRoute(
        path: 'reversements',
        builder: (_, _) => _page(
          create: (service, access) =>
              OwnerPayoutsViewModel(service, access.agencyId)..load(),
          child: const OwnerPayoutsScreen(),
        ),
      ),
      GoRoute(
        path: 'releve',
        builder: (_, _) => _page(
          create: (service, access) =>
              OwnerStatementViewModel(service, access.agencyId)..load(),
          child: const OwnerStatementScreen(),
        ),
      ),
      GoRoute(
        path: 'biens',
        builder: (_, _) => _page(
          create: (service, access) =>
              OwnerPropertiesViewModel(service, access.agencyId)..load(),
          child: const OwnerPropertiesScreen(),
        ),
      ),
      GoRoute(
        path: 'documents',
        builder: (_, _) => _page(
          create: (service, access) =>
              OwnerDocumentsViewModel(service, access.agencyId)..load(),
          child: const OwnerDocumentsScreen(),
        ),
      ),
    ],
  ),
];
