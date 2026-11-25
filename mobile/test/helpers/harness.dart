import 'package:eguardimmo/core/di/app_providers.dart';
import 'package:eguardimmo/core/routes/app_router.dart';
import 'package:eguardimmo/core/routes/app_routes.dart';
import 'package:eguardimmo/core/theme/app_theme.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:provider/provider.dart';

import 'fakes.dart';
import 'fixtures.dart';

class Harness({
  required final FakeApiClient api,
  required final MemoryTokenStorage tokens,
  required final GoRouter router,
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
  String location = AppRoutes.explore,
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
  final router = buildRouter(initialLocation: location);
  addTearDown(router.dispose);

  await tester.pumpWidget(
    MultiProvider(
      providers: buildProviders(api: api, tokenStorage: tokens),
      child: MaterialApp.router(
        theme: AppTheme.light(),
        locale: const Locale('fr', 'FR'),
        supportedLocales: const [Locale('fr', 'FR')],
        localizationsDelegates: GlobalMaterialLocalizations.delegates,
        routerConfig: router,
        builder: (context, child) => MediaQuery(
          data: MediaQuery.of(context)
              .copyWith(textScaler: TextScaler.linear(textScale)),
          child: child!,
        ),
      ),
    ),
  );
  await tester.pumpAndSettle();
  return Harness(api: api, tokens: tokens, router: router);
}
