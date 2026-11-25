import 'package:eguardimmo/core/config/provider_manager.dart';
import 'package:eguardimmo/core/routes/app_routes.dart';
import 'package:eguardimmo/core/routes/incoming_links.dart';
import 'package:eguardimmo/core/routes/router_manager.dart';
import 'package:eguardimmo/core/services/api_client.dart';
import 'package:eguardimmo/core/services/token_storage.dart';
import 'package:eguardimmo/core/theme/app_theme.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:provider/provider.dart';

import 'fakes.dart';
import 'fixtures.dart';
import 'test_router.dart';

class Harness({
  required final FakeApiClient api,
  required final MemoryTokenStorage tokens,
  required final TestRouter router,
}) {}

/// Handler de base : session connectée (`/me`, `/me/profiles`), le reste est
/// délégué à [extra] ; une route inconnue lève une erreur de test explicite.
FakeHandler appHandler(
  FakeHandler extra, {
  bool signedIn = true,
  List<Map<String, Object?>>? profiles,
}) {
  return (call) {
    final answer = extra(call);
    if (answer != null) return answer;
    if (call.path == '/me') {
      return signedIn
          ? Fixtures.me()
          : problem(401, 'unauthenticated', 'Non authentifié.');
    }
    if (call.path == '/me/profiles') {
      return Fixtures.profiles(profiles ?? [Fixtures.tenantProfile()]);
    }
    return null;
  };
}

Future<Harness> pumpApp(
  WidgetTester tester, {
  required FakeHandler handler,
  bool signedIn = true,
  String location = RouteName.explore,
  Size size = const Size(390, 844),
  double textScale = 1,
  List<Map<String, Object?>>? profiles,
}) async {
  await initializeDateFormatting('fr_FR');
  tester.view.physicalSize = size;
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);

  final tokens = MemoryTokenStorage(signedIn ? Fixtures.token : null);
  final api = FakeApiClient(
    appHandler(handler, signedIn: signedIn, profiles: profiles),
    storage: tokens,
  );
  final router = TestRouter();
  final navigatorKey = GlobalKey<NavigatorState>();

  await tester.pumpWidget(
    IncomingLinks(
      navigatorKey: navigatorKey,
      child: MultiProvider(
        key: UniqueKey(),
        providers: [
          Provider<TokenStorage>.value(value: tokens),
          Provider<ApiClient>.value(value: api),
          ...dependentServices,
        ],
        child: MaterialApp(
          navigatorKey: navigatorKey,
          theme: AppTheme.light(),
          locale: const Locale('fr', 'FR'),
          supportedLocales: const [Locale('fr', 'FR')],
          localizationsDelegates: GlobalMaterialLocalizations.delegates,
          initialRoute: location,
          onGenerateInitialRoutes: RouterManager.initialRoutes,
          onGenerateRoute: RouterManager.generateRoute,
          navigatorObservers: [router],
          builder: (context, child) => MediaQuery(
            data: MediaQuery.of(context)
                .copyWith(textScaler: TextScaler.linear(textScale)),
            child: child!,
          ),
        ),
      ),
    ),
  );
  await tester.pumpAndSettle();
  return Harness(api: api, tokens: tokens, router: router);
}

/// Livre un lien comme le fait la plateforme quand l'application est ouverte.
Future<void> receiveLink(WidgetTester tester, String location) async {
  await tester.binding.defaultBinaryMessenger.handlePlatformMessage(
    SystemChannels.navigation.name,
    SystemChannels.navigation.codec.encodeMethodCall(
      MethodCall('pushRouteInformation', {'location': location}),
    ),
    null,
  );
  await tester.pumpAndSettle();
}
