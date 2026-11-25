import 'package:eguardimmo/core/routes/app_routes.dart';
import 'package:eguardimmo/core/routes/route_error_screen.dart';
import 'package:eguardimmo/core/theme/app_theme.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

void main() {
  testWidgets('route introuvable : retour à l’accueil', (tester) async {
    final router = GoRouter(
      initialLocation: '/route-sans-ecran',
      errorBuilder: (_, _) => const RouteErrorScreen(),
      routes: [
        GoRoute(
          path: AppRoutes.explore,
          builder: (_, _) => const Scaffold(body: Text('Accueil')),
        ),
      ],
    );
    addTearDown(router.dispose);
    await tester.pumpWidget(
      MaterialApp.router(theme: AppTheme.light(), routerConfig: router),
    );
    await tester.pumpAndSettle();
    expect(find.text('Accueil'), findsOneWidget);
    expect(
      router.routerDelegate.currentConfiguration.uri.path,
      AppRoutes.explore,
    );
  });
}
