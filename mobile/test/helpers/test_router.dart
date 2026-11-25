import 'package:eguardimmo/core/routes/app_location.dart';
import 'package:eguardimmo/core/routes/deep_link_guard.dart';
import 'package:eguardimmo/core/routes/page_routes.dart';
import 'package:eguardimmo/core/routes/router_manager.dart';
import 'package:flutter/widgets.dart';

/// Suit la pile des écrans (feuilles et dialogues exclus) et pilote la
/// navigation depuis les tests.
class TestRouter() extends NavigatorObserver {
  final _pages = <Route<Object?>>[];

  List<AppLocation> get stack => [for (final route in _pages) _locate(route)];

  AppLocation get current => stack.last;

  /// [location] est un nom de route accompagné de son argument, ou un chemin
  /// complet tel qu'un lien profond le donnerait.
  void go(String location, {Object? arguments}) {
    final target = arguments == null
        ? DeepLinkGuard.resolve(Uri.parse(location))!
        : AppLocation(location, arguments);
    RouterManager.go(navigator!, target.name, arguments: target.arguments);
  }

  void pop() => navigator!.pop();

  AppLocation _locate(Route<Object?> route) => route is ShellRoute
      ? AppLocation(route.tab.value.route)
      : AppLocation(route.settings.name!, route.settings.arguments);

  bool _isPage(Route<Object?>? route) => route is PageRoute<Object?>;

  @override
  void didPush(Route<Object?> route, Route<Object?>? previousRoute) {
    if (_isPage(route)) _pages.add(route);
  }

  @override
  void didPop(Route<Object?> route, Route<Object?>? previousRoute) =>
      _pages.remove(route);

  @override
  void didRemove(Route<Object?> route, Route<Object?>? previousRoute) =>
      _pages.remove(route);

  @override
  void didReplace({Route<Object?>? newRoute, Route<Object?>? oldRoute}) {
    final index = _pages.indexOf(oldRoute!);
    if (index >= 0 && _isPage(newRoute)) _pages[index] = newRoute!;
  }
}
