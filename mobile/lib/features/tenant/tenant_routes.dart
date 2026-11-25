import 'package:flutter/widgets.dart';
import 'package:provider/provider.dart';
import 'package:provider/single_child_widget.dart';

import '../../core/routes/app_routes.dart';
import '../../core/routes/route_pages.dart';
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
import 'viewmodels/installment_detail_viewmodel.dart';
import 'viewmodels/installments_viewmodel.dart';
import 'viewmodels/new_request_viewmodel.dart';
import 'viewmodels/rent_history_viewmodels.dart';
import 'viewmodels/requests_viewmodel.dart';
import 'viewmodels/tenant_leases_viewmodels.dart';

Widget _page({
  required List<SingleChildWidget> providers,
  required Widget child,
}) => ProfileRouteGate(
  builder: (_) => MultiProvider(providers: providers, child: child),
);

Widget? tenantPage(String? name, Object? arguments) => switch (name) {
  RouteName.tenantHome => _page(
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
  RouteName.tenantRent => _page(
    providers: [
      ChangeNotifierProvider(
        create: (c) =>
            InstallmentsViewModel(c.read<TenantRentService>())..load(),
      ),
      ChangeNotifierProvider(
        create: (c) => PaymentsViewModel(c.read<TenantRentService>())..load(),
      ),
      ChangeNotifierProvider(
        create: (c) => ReceiptsViewModel(c.read<TenantRentService>())..load(),
      ),
    ],
    child: const RentScreen(),
  ),
  RouteName.tenantInstallment => resourcePage(
    arguments,
    (id) => _page(
      providers: [
        ChangeNotifierProvider(
          key: ValueKey(id),
          create: (c) =>
              InstallmentDetailViewModel(c.read<TenantRentService>(), id)
                ..load(),
        ),
      ],
      child: const InstallmentScreen(),
    ),
  ),
  RouteName.tenantRequests => _page(
    providers: [
      ChangeNotifierProvider(
        create: (c) =>
            RequestsViewModel(c.read<TenantMaintenanceService>())..load(),
      ),
    ],
    child: const RequestsScreen(),
  ),
  RouteName.tenantNewRequest => _page(
    providers: [
      ChangeNotifierProvider(
        create: (c) =>
            NewRequestViewModel(c.read<TenantMaintenanceService>())..load(),
      ),
    ],
    child: const NewRequestScreen(),
  ),
  RouteName.tenantRequest => resourcePage(
    arguments,
    (id) => _page(
      providers: [
        ChangeNotifierProvider(
          key: ValueKey(id),
          create: (c) =>
              RequestDetailViewModel(c.read<TenantMaintenanceService>(), id)
                ..load(),
        ),
      ],
      child: const RequestDetailScreen(),
    ),
  ),
  RouteName.tenantDocuments => _page(
    providers: [
      ChangeNotifierProvider(
        create: (c) =>
            TenantDocumentsViewModel(c.read<TenantLeasesService>())..load(),
      ),
    ],
    child: const DocumentsScreen(),
  ),
  _ => null,
};
