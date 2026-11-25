import 'package:flutter/widgets.dart';
import 'package:provider/provider.dart';
import 'package:provider/single_child_widget.dart';

import '../../core/routes/app_routes.dart';
import '../../core/routes/route_pages.dart';
import '../profiles/widgets/profile_route_gate.dart';
import 'screens/agency_home_screen.dart';
import 'screens/intervention_detail_screen.dart';
import 'screens/interventions_screen.dart';
import 'screens/portfolio_screen.dart';
import 'screens/unpaid_screen.dart';
import 'services/agency_access_service.dart';
import 'services/agency_maintenance_service.dart';
import 'services/agency_service.dart';
import 'viewmodels/agency_access_viewmodels.dart';
import 'viewmodels/agency_intervention_viewmodel.dart';
import 'viewmodels/agency_viewmodels.dart';
import 'widgets/agency_gate.dart';

Widget _page({
  required List<SingleChildWidget> Function(
    AgencyService service,
    String organization,
  )
  providers,
  required Widget child,
}) => ProfileRouteGate(
  builder: (_) => AgencyGate(
    builder: (context, organization) => MultiProvider(
      key: ValueKey(organization),
      providers: providers(context.read<AgencyService>(), organization),
      child: child,
    ),
  ),
);

Widget? agencyPage(String? name, Object? arguments) => switch (name) {
  RouteName.agencyHome => _page(
    providers: (service, organization) => [
      ChangeNotifierProvider(
        create: (_) => AgencyKpisViewModel(service, organization)..load(),
      ),
      ChangeNotifierProvider(
        create: (_) => AgencyPayoutsViewModel(service, organization)..load(),
      ),
      ChangeNotifierProvider(
        create: (_) => AgencyAlertsViewModel(service, organization)..load(),
      ),
    ],
    child: const AgencyHomeScreen(),
  ),
  RouteName.agencyUnpaid => _page(
    providers: (service, organization) => [
      ChangeNotifierProvider(
        create: (_) => UnpaidViewModel(service, organization)..load(),
      ),
      ChangeNotifierProvider(
        create: (c) =>
            AgencyAccessViewModel(c.read<AgencyAccessService>(), organization)
              ..load(),
      ),
    ],
    child: const UnpaidScreen(),
  ),
  RouteName.agencyInterventions => _page(
    providers: (service, organization) => [
      ChangeNotifierProvider(
        create: (_) =>
            AgencyInterventionsViewModel(service, organization)..load(),
      ),
    ],
    child: const AgencyInterventionsScreen(),
  ),
  RouteName.agencyIntervention => resourcePage(arguments, _intervention),
  RouteName.agencyPortfolio => _page(
    providers: (service, organization) => [
      ChangeNotifierProvider(
        create: (_) => AgencyPropertiesViewModel(service, organization)..load(),
      ),
      ChangeNotifierProvider(
        create: (_) => AgencyLeasesViewModel(service, organization)..load(),
      ),
    ],
    child: const PortfolioScreen(),
  ),
  _ => null,
};

Widget _intervention(String id) => _page(
  providers: (service, organization) => [
    ChangeNotifierProvider(
      key: ValueKey(id),
      create: (c) => AgencyInterventionViewModel(
        c.read<AgencyMaintenanceService>(),
        organization,
        id,
      )..load(),
    ),
    ChangeNotifierProvider(
      create: (c) =>
          AgencyAccessViewModel(c.read<AgencyAccessService>(), organization)
            ..load(),
    ),
    ChangeNotifierProvider(
      create: (c) => AgencySuppliersViewModel(
        c.read<AgencyMaintenanceService>(),
        organization,
      ),
    ),
  ],
  child: const InterventionDetailScreen(),
);
