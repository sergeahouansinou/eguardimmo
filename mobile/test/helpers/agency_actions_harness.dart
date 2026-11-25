import 'package:eguardimmo/core/routes/app_routes.dart';
import 'package:eguardimmo/core/routes/route_args.dart';
import 'package:eguardimmo/core/widgets/app_sheet.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'agency_actions_api.dart';
import 'api_fixtures.dart';
import 'fakes.dart';
import 'fixtures.dart';
import 'harness.dart';

Future<(Harness, ActionsApi)> openIntervention(
  WidgetTester tester, {
  ActionsApi? server,
  String path = '',
  Size size = const Size(390, 3600),
  double textScale = 1,
}) async {
  final api = server ?? ActionsApi();
  final app = await pumpApp(
    tester,
    handler: api.call,
    size: size,
    textScale: textScale,
    profiles: [Fixtures.organizationProfile(kind: 'agency')],
  );
  await tester.tap(find.text('Profil : Voyageur'));
  await tester.pumpAndSettle();
  await tester.tap(find.text('Agence Rhône Immo'));
  await tester.pumpAndSettle();
  if (path.isEmpty) {
    app.router.go(
      RouteName.agencyIntervention,
      arguments: const ResourceArgs(interventionId),
    );
  } else {
    app.router.go(path);
  }
  await tester.pumpAndSettle();
  return (app, api);
}

Future<void> tapText(WidgetTester tester, String text) async {
  final finder = find.text(text);
  await tester.ensureVisible(finder);
  await tester.tap(finder);
  await tester.pumpAndSettle();
}

Finder sheetField() => find.descendant(
  of: find.byType(AppSheet),
  matching: find.byType(TextFormField),
);

List<RecordedCall> postsOf(Harness app) =>
    app.api.calls.where((c) => c.method == 'POST').toList();

ActionsApi serverWith(String fixture, {String? after, String? roles}) {
  final server = ActionsApi()..detail = apiFixture(fixture);
  if (after != null) server.afterWrite = apiFixture(after);
  if (roles != null) server.roles = roles;
  return server;
}
