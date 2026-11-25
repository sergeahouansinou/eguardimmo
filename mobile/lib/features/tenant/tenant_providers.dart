import 'package:provider/provider.dart';
import 'package:provider/single_child_widget.dart';

import '../../core/services/api_client.dart';
import 'services/tenant_leases_service.dart';
import 'services/tenant_maintenance_service.dart';
import 'services/tenant_rent_service.dart';

List<SingleChildWidget> tenantProviders() => [
  ProxyProvider<ApiClient, TenantRentService>(
    update: (_, api, _) => TenantRentService(api),
  ),
  ProxyProvider<ApiClient, TenantLeasesService>(
    update: (_, api, _) => TenantLeasesService(api),
  ),
  ProxyProvider<ApiClient, TenantMaintenanceService>(
    update: (_, api, _) => TenantMaintenanceService(api),
  ),
];
