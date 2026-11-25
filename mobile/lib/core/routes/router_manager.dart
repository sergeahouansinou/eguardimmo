import 'package:flutter/widgets.dart';

import '../../features/agency/agency_routes.dart';
import '../../features/auth/auth_routes.dart';
import '../../features/messages/messages_routes.dart';
import '../../features/owner/owner_routes.dart';
import '../../features/sebook/sebook_routes.dart';
import '../../features/support/support_routes.dart';
import '../../features/tenant/tenant_routes.dart';
import '../widgets/app_shell.dart';
import 'app_location.dart';
import 'app_routes.dart';
import 'app_tab.dart';
import 'deep_link_guard.dart';
import 'page_routes.dart';
import 'route_error_screen.dart';

/// Les pages appartiennent aux features ; ce gestionnaire les assemble,
/// porte la hiérarchie des écrans et filtre les liens entrants.
abstract final class RouterManager() {
  static const _home = AppLocation(RouteName.explore);

  static const _parents = {
    RouteName.listing: RouteName.explore,
    RouteName.login: RouteName.explore,
    RouteName.tenantRent: RouteName.tenantHome,
    RouteName.tenantInstallment: RouteName.tenantRent,
    RouteName.tenantRequests: RouteName.tenantHome,
    RouteName.tenantNewRequest: RouteName.tenantRequests,
    RouteName.tenantRequest: RouteName.tenantRequests,
    RouteName.tenantDocuments: RouteName.tenantHome,
    RouteName.ownerPayouts: RouteName.ownerHome,
    RouteName.ownerStatement: RouteName.ownerHome,
    RouteName.ownerProperties: RouteName.ownerHome,
    RouteName.ownerDocuments: RouteName.ownerHome,
    RouteName.agencyUnpaid: RouteName.agencyHome,
    RouteName.agencyInterventions: RouteName.agencyHome,
    RouteName.agencyIntervention: RouteName.agencyInterventions,
    RouteName.agencyPortfolio: RouteName.agencyHome,
    RouteName.newConversation: RouteName.messages,
    RouteName.conversation: RouteName.messages,
    RouteName.support: RouteName.messages,
    RouteName.newSupportTicket: RouteName.messages,
    RouteName.supportTicket: RouteName.messages,
  };

  static Route<Object?> generateRoute(RouteSettings settings) {
    final tab = AppTab.named(settings.name);
    if (tab != null) {
      final selected = ValueNotifier(tab);
      return ShellRoute(
        selected,
        AppShell(tab: selected, pageFor: _tabPage),
        settings: settings,
      );
    }
    final page =
        _page(settings.name, settings.arguments) ?? const RouteErrorScreen();
    return slideInRoute(page, settings);
  }

  static List<Route<Object?>> initialRoutes(String location) => [
    for (final step in stackFor(_resolve(location) ?? _home))
      generateRoute(step.settings),
  ];

  /// La destination précédée de ses écrans parents, racine en tête.
  static List<AppLocation> stackFor(AppLocation target) {
    final stack = [target];
    var parent = _parents[target.name];
    while (parent != null) {
      stack.insert(0, AppLocation(parent));
      parent = _parents[parent];
    }
    return stack;
  }

  /// Revient à la destination si elle est déjà ouverte, sinon repart de sa
  /// hiérarchie. La racine déjà ouverte garde son état, onglets compris.
  static void go(NavigatorState navigator, String name, {Object? arguments}) {
    final stack = stackFor(AppLocation(name, arguments));
    final root = stack.first;
    final tab = AppTab.named(root.name);
    var rootKept = false;
    var alreadyOpen = false;
    navigator.popUntil((route) {
      if (route is ShellRoute) {
        if (tab == null) return route.isFirst;
        route.tab.value = tab;
        return rootKept = true;
      }
      final settings = route.settings;
      if (settings.name == name && settings.arguments == arguments) {
        return alreadyOpen = true;
      }
      if (settings.name == root.name) return rootKept = true;
      return route.isFirst;
    });
    if (alreadyOpen) return;
    if (!rootKept) {
      navigator
          .pushNamedAndRemoveUntil(
            root.name,
            (_) => false,
            arguments: root.arguments,
          )
          .ignore();
    }
    for (final step in stack.skip(1)) {
      navigator.pushNamed(step.name, arguments: step.arguments).ignore();
    }
  }

  /// Lien reçu application ouverte : la pile est repositionnée, pas empilée.
  static void openLink(NavigatorState navigator, Uri uri) {
    final target = DeepLinkGuard.resolve(uri) ?? _home;
    go(navigator, target.name, arguments: target.arguments);
  }

  static AppLocation? _resolve(String location) {
    final uri = Uri.tryParse(location);
    return uri == null ? null : DeepLinkGuard.resolve(uri);
  }

  static Widget? _page(String? name, Object? arguments) =>
      authPage(name) ??
      sebookPage(name, arguments) ??
      messagesPage(name, arguments) ??
      supportPage(name, arguments) ??
      tenantPage(name, arguments) ??
      ownerPage(name) ??
      agencyPage(name, arguments);

  static Widget _tabPage(AppTab tab) => switch (tab) {
    AppTab.explore => exploreTab(),
    AppTab.stays => staysTab(),
    AppTab.messages => messagesTab(),
    AppTab.account => accountTab(),
  };
}
