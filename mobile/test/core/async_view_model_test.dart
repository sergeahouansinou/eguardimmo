import 'dart:async';

import 'package:eguardimmo/core/services/api_exception.dart';
import 'package:eguardimmo/core/services/app_logger.dart';
import 'package:eguardimmo/core/state/async_view_model.dart';
import 'package:eguardimmo/core/state/load_state.dart';
import 'package:eguardimmo/core/utils/cursor_pages.dart';
import 'package:flutter_test/flutter_test.dart';

class _ViewModel(var Future<int> Function() action, {super.logger})
    extends AsyncViewModel<int> {
  @override
  Future<int> fetch() => action();

  String? selected;

  @override
  void resetForKeyChange() => selected = null;

  void replace(int value) => replaceData(value);
}

Future<void> _settle() async {
  await Future<void>.delayed(Duration.zero);
  await Future<void>.delayed(Duration.zero);
}

void main() {
  test('chargement réussi : Loading puis Loaded', () async {
    final viewModel = _ViewModel(() async => 7);
    final seen = <Type>[];
    viewModel.addListener(() => seen.add(viewModel.state.runtimeType));
    await viewModel.load();
    expect(seen, [Loading<int>, Loaded<int>]);
    expect(viewModel.state.dataOrNull, 7);
  });

  test(
    'ApiException : message du serveur, donnée précédente conservée',
    () async {
      final viewModel = _ViewModel(() async => 1);
      await viewModel.load();
      viewModel.action = () async =>
          throw const ApiException(statusCode: 500, message: 'Panne serveur');
      await viewModel.load();
      final state = viewModel.state as Failed<int>;
      expect(state.message, 'Panne serveur');
      expect(state.previous, 1);
    },
  );

  test('exception inattendue : message générique ET journalisation', () async {
    final reported = <Object>[];
    final viewModel = _ViewModel(
      () async => throw const FormatException('JSON cassé'),
      logger: AppLogger(
        reporter: (error, _, {required fatal}) => reported.add(error),
      ),
    );
    await viewModel.load();
    expect(
      (viewModel.state as Failed<int>).message,
      AsyncViewModel.genericFailure,
    );
    expect(reported.single, isA<FormatException>());
  });

  test(
    'requête annulée : retour à l’état précédent, pas d’erreur affichée',
    () async {
      final viewModel = _ViewModel(() async => 3);
      await viewModel.load();
      viewModel.action = () async => throw const ApiException(
        statusCode: null,
        message: 'x',
        cancelled: true,
      );
      await viewModel.load();
      expect(viewModel.state, isA<Loaded<int>>());
    },
  );

  test('un Error n’est jamais avalé', () async {
    final viewModel = _ViewModel(() async => throw StateError('bogue'));
    await expectLater(viewModel.load(), throwsA(isA<StateError>()));
  });

  test('aucune notification après dispose', () async {
    final viewModel = _ViewModel(() async {
      await Future<void>.delayed(const Duration(milliseconds: 10));
      return 1;
    });
    final loading = viewModel.load();
    viewModel.dispose();
    await loading;
  });

  test('réponse tardive d’un chargement remplacé : ignorée', () async {
    final slow = Completer<int>();
    final viewModel = _ViewModel(() => slow.future);
    final first = viewModel.load();
    viewModel.action = () async => 2;
    await viewModel.load(keepPrevious: false);
    slow.complete(1);
    await first;
    expect(viewModel.state.dataOrNull, 2);
  });

  test('échec tardif d’un chargement remplacé : ignoré', () async {
    final slow = Completer<int>();
    final viewModel = _ViewModel(() => slow.future);
    final first = viewModel.load();
    viewModel.action = () async => 3;
    await viewModel.load();
    slow.completeError(
      const ApiException(statusCode: 500, message: 'Panne serveur'),
    );
    await first;
    expect(viewModel.state, isA<Loaded<int>>());
    expect(viewModel.state.dataOrNull, 3);
  });

  test(
    'déconnexion pendant un chargement : les données ne reviennent pas',
    () async {
      final slow = Completer<int>();
      final viewModel = _ViewModel(() => slow.future);
      viewModel.bind('u1');
      await Future<void>.delayed(Duration.zero);
      viewModel.bind(null);
      await Future<void>.delayed(Duration.zero);
      slow.complete(9);
      await Future<void>.delayed(Duration.zero);
      expect(viewModel.state, isA<Idle<int>>());
    },
  );

  group('changement de clé', () {
    test('les données de l’ancien compte ne sont plus visibles, ni pendant le '
        'chargement ni après un échec', () async {
      final viewModel = _ViewModel(() async => 1);
      viewModel.bind('a');
      await _settle();
      expect(viewModel.state.dataOrNull, 1);

      final pending = Completer<int>();
      viewModel.action = () => pending.future;
      viewModel.bind('b');
      expect(viewModel.state.dataOrNull, isNull);
      await _settle();
      expect(viewModel.state, isA<Loading<int>>());
      expect(viewModel.state.dataOrNull, isNull);

      pending.completeError(
        const ApiException(statusCode: 500, message: 'Panne serveur'),
      );
      await _settle();
      expect(viewModel.state, isA<Failed<int>>());
      expect(viewModel.state.dataOrNull, isNull);
    });

    test('réponse tardive de l’ancien compte : ignorée', () async {
      final late = Completer<int>();
      final viewModel = _ViewModel(() => late.future);
      viewModel.bind('a');
      await _settle();
      viewModel.action = () async => 2;
      viewModel.bind('b');
      await _settle();
      late.complete(1);
      await _settle();
      expect(viewModel.state.dataOrNull, 2);
    });

    test('le contexte propre au compte est remis à zéro', () async {
      final viewModel = _ViewModel(() async => 1);
      viewModel.bind('a');
      await _settle();
      viewModel.selected = 'choix de a';
      viewModel.bind('b');
      expect(viewModel.selected, isNull);
    });
  });

  group('échec avec données conservées', () {
    for (final status in [403, 404]) {
      test('$status : l’ancienne donnée n’est pas conservée', () async {
        final viewModel = _ViewModel(() async => 1);
        await viewModel.load();
        viewModel.action = () async =>
            throw ApiException(statusCode: status, message: 'Refusé');
        await viewModel.load();
        final state = viewModel.state as Failed<int>;
        expect(state.message, 'Refusé');
        expect(state.previous, isNull);
        expect(viewModel.state.dataOrNull, isNull);
      });
    }
  });

  test(
    'replaceData : une réponse tardive n’annule pas l’action visible',
    () async {
      final slow = Completer<int>();
      final viewModel = _ViewModel(() => slow.future);
      final loading = viewModel.load();
      viewModel.replace(5);
      slow.complete(1);
      await loading;
      expect(viewModel.state.dataOrNull, 5);
      expect(viewModel.state, isA<Loaded<int>>());
    },
  );

  test(
    'liste tronquée : échec visible avec son message, sans donnée',
    () async {
      final viewModel = _ViewModel(
        () async => throw const ListTruncatedException(),
      );
      await viewModel.load();
      final state = viewModel.state as Failed<int>;
      expect(state.message, const ListTruncatedException().message);
      expect(state.message, isNot(AsyncViewModel.genericFailure));
      expect(state.previous, isNull);
    },
  );
}
