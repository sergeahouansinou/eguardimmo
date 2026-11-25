import 'package:eguardimmo/core/routes/app_location.dart';
import 'package:eguardimmo/core/routes/app_routes.dart';
import 'package:flutter_test/flutter_test.dart';

import '../helpers/fixtures.dart';
import '../helpers/harness.dart';

void main() {
  testWidgets('route introuvable : retour à l’accueil', (tester) async {
    final app = await pumpApp(
      tester,
      handler: (call) =>
          call.path.startsWith('/marketplace/') ? Fixtures.page([]) : null,
    );
    app.router.navigator!.pushNamed('/route-sans-ecran').ignore();
    await tester.pumpAndSettle();
    expect(app.router.stack, [const AppLocation(RouteName.explore)]);
  });
}
