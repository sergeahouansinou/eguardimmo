import 'package:eguardimmo/core/routes/app_routes.dart';
import 'package:eguardimmo/features/profiles/models/app_profile.dart';
import 'package:eguardimmo/features/profiles/viewmodels/profiles_viewmodel.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';

import 'fakes.dart';
import 'fixtures.dart';
import 'harness.dart';

enum TestProfile() {
  traveler,
  tenant,
  owner,
  agency,
  landlord,
}

Map<String, Object?>? _entry(TestProfile profile) => switch (profile) {
  TestProfile.traveler => null,
  TestProfile.tenant => Fixtures.tenantProfile(),
  TestProfile.owner => Fixtures.ownerProfile(),
  TestProfile.agency => Fixtures.organizationProfile(kind: 'agency'),
  TestProfile.landlord => Fixtures.organizationProfile(
    kind: 'individual',
    name: 'SCI Les Tilleuls',
    id: '0193d2a0-0000-7000-8000-0000000000bb',
  ),
};

/// Ouvre l'application connectée, active le profil demandé puis va à
/// [location]. Les écrans interrogés périodiquement sont démontés à la fin
/// pour que leurs minuteries ne survivent pas au test.
Future<Harness> pumpAsProfile(
  WidgetTester tester, {
  required TestProfile profile,
  required FakeHandler handler,
  String location = AppRoutes.messages,
  Size size = const Size(390, 844),
  double textScale = 1,
}) async {
  final entry = _entry(profile);
  final harness = await pumpApp(
    tester,
    handler: handler,
    location: AppRoutes.explore,
    size: size,
    textScale: textScale,
    profiles: [?entry],
  );
  addTearDown(() async {
    await tester.pumpWidget(const SizedBox());
    await tester.pump();
  });
  final profiles = Provider.of<ProfilesViewModel>(
    tester.element(find.byType(MaterialApp)),
    listen: false,
  );
  if (entry != null) {
    final wanted = profiles.profiles.firstWhere(
      (p) => p.kind != ProfileKind.traveler,
    );
    profiles.select(wanted);
  }
  harness.router.go(location);
  await tester.pumpAndSettle();
  return harness;
}
