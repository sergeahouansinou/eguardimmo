import 'package:flutter/widgets.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../profiles/widgets/profile_route_gate.dart';
import 'screens/documents_screen.dart';
import 'screens/installment_screen.dart';
import 'screens/new_request_screen.dart';
import 'screens/rent_screen.dart';
import 'screens/request_detail_screen.dart';
import 'screens/requests_screen.dart';
import 'screens/tenant_home_screen.dart';
import 'services/tenant_leases_service.dart';
import 'services/tenant_maintenance_service.dart';
import 'services/tenant_rent_service.dart';
import 'tenant_paths.dart';
import 'viewmodels/installment_detail_viewmodel.dart';
import 'viewmodels/installments_viewmodel.dart';
import 'viewmodels/new_request_viewmodel.dart';
import 'viewmodels/rent_history_viewmodels.dart';
import 'viewmodels/requests_viewmodel.dart';
import 'viewmodels/tenant_leases_viewmodels.dart';

List<RouteBase> tenantRoutes() => [
  GoRoute(
    path: TenantPaths.home,
    builder: (_, _) => ProfileRouteGate(
      builder: (_) => MultiProvider(
        providers: [
          ChangeNotifierProvider(
            create: (c) =>
                InstallmentsViewModel(c.read<TenantRentService>())..load(),
          ),
          ChangeNotifierProvider(
            create: (c) =>
                TenantLeasesViewModel(c.read<TenantLeasesService>())..load(),
          ),
          ChangeNotifierProvider(
            create: (c) =>
                RequestsViewModel(c.read<TenantMaintenanceService>())..load(),
          ),
        ],
        child: const TenantHomeScreen(),
      ),
    ),
    routes: [
      GoRoute(
        path: 'loyers',
        builder: (_, _) => ProfileRouteGate(
          builder: (_) => MultiProvider(
            providers: [
              ChangeNotifierProvider(
                create: (c) =>
                    InstallmentsViewModel(c.read<TenantRentService>())..load(),
              ),
              ChangeNotifierProvider(
                create: (c) =>
                    PaymentsViewModel(c.read<TenantRentService>())..load(),
              ),
              ChangeNotifierProvider(
                create: (c) =>
                    ReceiptsViewModel(c.read<TenantRentService>())..load(),
              ),
            ],
            child: const RentScreen(),
          ),
        ),
        routes: [
          GoRoute(
            path: ':id',
            builder: (_, state) => ProfileRouteGate(
              builder: (_) => ChangeNotifierProvider(
                key: ValueKey(state.pathParameters['id']),
                create: (c) => InstallmentDetailViewModel(
                  c.read<TenantRentService>(),
                  state.pathParameters['id']!,
                )..load(),
                child: const InstallmentScreen(),
              ),
            ),
          ),
        ],
      ),
      GoRoute(
        path: 'demandes',
        builder: (_, _) => ProfileRouteGate(
          builder: (_) => ChangeNotifierProvider(
            create: (c) =>
                RequestsViewModel(c.read<TenantMaintenanceService>())..load(),
            child: const RequestsScreen(),
          ),
        ),
        routes: [
          GoRoute(
            path: 'nouvelle',
            builder: (_, _) => ProfileRouteGate(
              builder: (_) => ChangeNotifierProvider(
                create: (c) =>
                    NewRequestViewModel(c.read<TenantMaintenanceService>())
                      ..load(),
                child: const NewRequestScreen(),
              ),
            ),
          ),
          GoRoute(
            path: ':id',
            builder: (_, state) => ProfileRouteGate(
              builder: (_) => ChangeNotifierProvider(
                key: ValueKey(state.pathParameters['id']),
                create: (c) => RequestDetailViewModel(
                  c.read<TenantMaintenanceService>(),
                  state.pathParameters['id']!,
                )..load(),
                child: const RequestDetailScreen(),
              ),
            ),
          ),
        ],
      ),
      GoRoute(
        path: 'documents',
        builder: (_, _) => ProfileRouteGate(
          builder: (_) => ChangeNotifierProvider(
            create: (c) =>
                TenantDocumentsViewModel(c.read<TenantLeasesService>())..load(),
            child: const DocumentsScreen(),
          ),
        ),
      ),
    ],
  ),
];
