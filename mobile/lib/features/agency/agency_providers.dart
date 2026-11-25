import 'package:provider/provider.dart';
import 'package:provider/single_child_widget.dart';

import '../../core/services/api_client.dart';
import 'services/agency_access_service.dart';
import 'services/agency_maintenance_service.dart';
import 'services/agency_service.dart';

List<SingleChildWidget> agencyProviders() => [
  ProxyProvider<ApiClient, AgencyService>(
    update: (_, api, _) => AgencyService(api),
  ),
  ProxyProvider<ApiClient, AgencyMaintenanceService>(
    update: (_, api, _) => AgencyMaintenanceService(api),
  ),
  ProxyProvider<ApiClient, AgencyAccessService>(
    update: (_, api, _) => AgencyAccessService(api),
  ),
];
