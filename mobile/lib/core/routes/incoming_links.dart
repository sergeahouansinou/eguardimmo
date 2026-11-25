import 'package:flutter/widgets.dart';

import 'router_manager.dart';

/// Doit envelopper l'application : inscrit avant `WidgetsApp`, il l'empêche
/// d'empiler les liens reçus.
class const IncomingLinks({
  super.key,
  required final GlobalKey<NavigatorState> navigatorKey,
  required final Widget child,
}) extends StatefulWidget {
  @override
  State<IncomingLinks> createState() => _IncomingLinksState();
}

class _IncomingLinksState()
    extends State<IncomingLinks>
    with WidgetsBindingObserver {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  Future<bool> didPushRouteInformation(
    RouteInformation routeInformation,
  ) async {
    final navigator = widget.navigatorKey.currentState;
    if (navigator == null) return false;
    RouterManager.openLink(navigator, routeInformation.uri);
    return true;
  }

  @override
  Widget build(BuildContext context) => widget.child;
}
