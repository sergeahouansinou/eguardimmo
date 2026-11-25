import 'package:eguardimmo/core/services/app_logger.dart';
import 'package:eguardimmo/core/state/load_state.dart';
import 'package:eguardimmo/features/profiles/models/app_profile.dart';
import 'package:eguardimmo/features/profiles/services/profiles_service.dart';
import 'package:eguardimmo/features/profiles/viewmodels/profiles_viewmodel.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../helpers/fakes.dart';
import '../../helpers/fixtures.dart';

void main() {
  test(
    'le voyageur est toujours présent, même sans aucun profil serveur',
    () async {
      final api = FakeApiClient((_) => Fixtures.profiles([]));
      final profiles = await ProfilesService(api).fetch();
      expect(profiles.map((p) => p.kind), [ProfileKind.traveler]);
      expect(api.calls.single.path, '/me/profiles');
    },
  );

  test(
    'locataire, propriétaire mandant, bailleur autonome et agence',
    () async {
      final api = FakeApiClient(
        (_) => Fixtures.profiles([
          Fixtures.tenantProfile(),
          Fixtures.ownerProfile(),
          Fixtures.organizationProfile(
            kind: 'individual',
            name: 'Jeanne Martin',
            id: 'o1',
          ),
          Fixtures.organizationProfile(
            kind: 'agency',
            name: 'Agence Rhône Immo',
            id: 'o2',
          ),
        ]),
      );
      final profiles = await ProfilesService(api).fetch();

      expect(profiles.map((p) => (p.kind, p.label)), [
        (ProfileKind.traveler, 'Voyageur'),
        (ProfileKind.tenant, 'Locataire'),
        (ProfileKind.owner, 'Propriétaire mandant'),
        (ProfileKind.owner, 'Jeanne Martin'),
        (ProfileKind.agency, 'Agence Rhône Immo'),
      ]);
      expect(profiles.map((p) => p.id).toSet(), hasLength(5));
    },
  );

  test('la console n’existe pas dans l’application mobile', () async {
    final api = FakeApiClient(
      (_) => Fixtures.profiles([
        Fixtures.operatorProfile(),
        Fixtures.tenantProfile(),
      ]),
    );
    final profiles = await ProfilesService(api).fetch();
    expect(profiles.map((p) => p.kind), [
      ProfileKind.traveler,
      ProfileKind.tenant,
    ]);
  });

  test('un espace inconnu est ignoré mais journalisé', () async {
    final api = FakeApiClient(
      (_) => Fixtures.profiles([
        {
          'space': 'partner',
          'label': 'Partenaire',
          'meta': <String, Object?>{},
        },
      ]),
    );
    final profiles = await ProfilesService(
      api,
      logger: const AppLogger(enabled: false),
    ).fetch();
    expect(profiles, hasLength(1));
  });

  test('un profil de forme inattendue lève une FormatException', () async {
    final api = FakeApiClient(
      (_) => Fixtures.profiles([
        {'space': 'tenant'},
      ]),
    );
    await expectLater(ProfilesService(api).fetch(), throwsFormatException);
  });

  test(
    'profil actif : sélection puis retour au voyageur à la déconnexion',
    () async {
      final api = FakeApiClient(
        (_) => Fixtures.profiles([Fixtures.tenantProfile()]),
      );
      final viewModel = ProfilesViewModel(ProfilesService(api));
      expect(viewModel.profiles, [AppProfile.traveler]);

      viewModel.bind('user-1');
      await Future<void>.delayed(Duration.zero);
      await Future<void>.delayed(Duration.zero);
      expect(viewModel.state, isA<Loaded<List<AppProfile>>>());

      viewModel.select(viewModel.profiles.last);
      expect(viewModel.active.kind, ProfileKind.tenant);

      viewModel.bind(null);
      await Future<void>.delayed(Duration.zero);
      expect(viewModel.active.kind, ProfileKind.traveler);
      expect(viewModel.state, isA<Idle<List<AppProfile>>>());
    },
  );

  test(
    'échec de chargement : état visible, voyageur toujours utilisable',
    () async {
      final api = FakeApiClient((_) => networkFailure());
      final viewModel = ProfilesViewModel(ProfilesService(api));
      await viewModel.load();
      expect(viewModel.state, isA<Failed<List<AppProfile>>>());
      expect(viewModel.active, AppProfile.traveler);
    },
  );

  test(
    'passage direct du compte A au compte B : profil actif remis au voyageur '
    'et profils de A invisibles, même si le chargement de B échoue',
    () async {
      var failing = false;
      final api = FakeApiClient(
        (_) => failing
            ? networkFailure()
            : Fixtures.profiles([Fixtures.tenantProfile()]),
      );
      final viewModel = ProfilesViewModel(ProfilesService(api));
      viewModel.bind('user-a');
      await Future<void>.delayed(Duration.zero);
      await Future<void>.delayed(Duration.zero);
      viewModel.select(viewModel.profiles.last);
      expect(viewModel.active.kind, ProfileKind.tenant);

      failing = true;
      viewModel.bind('user-b');
      expect(viewModel.active, AppProfile.traveler);
      await Future<void>.delayed(Duration.zero);
      await Future<void>.delayed(Duration.zero);
      expect(viewModel.state, isA<Failed<List<AppProfile>>>());
      expect(viewModel.profiles, [AppProfile.traveler]);
      expect(viewModel.active, AppProfile.traveler);
    },
  );

  test('le profil actif de A n’est pas repris par B quand B possède le même profil', () async {
    final api = FakeApiClient(
      (_) => Fixtures.profiles([Fixtures.tenantProfile()]),
    );
    final viewModel = ProfilesViewModel(ProfilesService(api));
    viewModel.bind('user-a');
    await Future<void>.delayed(Duration.zero);
    await Future<void>.delayed(Duration.zero);
    viewModel.select(viewModel.profiles.last);

    viewModel.bind('user-b');
    await Future<void>.delayed(Duration.zero);
    await Future<void>.delayed(Duration.zero);
    expect(viewModel.profiles, hasLength(2));
    expect(viewModel.active, AppProfile.traveler);
  });
}
