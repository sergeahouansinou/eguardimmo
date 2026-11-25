import 'dart:async';

import 'package:eguardimmo/core/services/api_exception.dart';
import 'package:eguardimmo/core/state/async_view_model.dart';
import 'package:eguardimmo/core/state/idempotent_writes.dart';
import 'package:flutter_test/flutter_test.dart';

import '../helpers/fakes.dart';

class _Probe(final Future<void> Function(String key) onSend)
    extends AsyncViewModel<int>
    with IdempotentWrites<int> {
  @override
  Future<int> fetch() async => 1;

  Future<WriteResult> send([String fingerprint = 'a']) =>
      write(fingerprint, onSend);
}

final _uuidV4 = RegExp(
  r'^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$',
);

void main() {
  test('la clé envoyée est un UUID v4 généré aléatoirement', () async {
    final keys = <String>[];
    final probe = _Probe((key) async => keys.add(key));
    await probe.send();
    await probe.send();
    expect(keys.first, matches(_uuidV4));
    expect(keys.last, matches(_uuidV4));
    expect(keys.first, isNot(keys.last));
  });

  test(
    'succès : résultat WriteDone et nouvelle clé pour la demande suivante',
    () async {
      final keys = <String>[];
      final probe = _Probe((key) async => keys.add(key));
      expect(await probe.send(), isA<WriteDone>());
      await probe.send();
      expect(keys[0], isNot(keys[1]));
    },
  );

  for (final failure in <(String, ApiException)>[
    ('réseau', networkFailure()),
    ('5xx', problem(503, 'unavailable', 'Indisponible.')),
    ('408', problem(408, 'timeout', 'Délai dépassé.')),
    ('429', problem(429, 'too_many_requests', 'Trop de requêtes.')),
  ]) {
    test(
      '${failure.$1} : même clé au nouvel essai de la même demande',
      () async {
        final keys = <String>[];
        var first = true;
        final probe = _Probe((key) async {
          keys.add(key);
          if (first) {
            first = false;
            throw failure.$2;
          }
        });
        expect(await probe.send(), isA<WriteRefused>());
        expect(await probe.send(), isA<WriteDone>());
        expect(keys[0], keys[1]);
      },
    );
  }

  for (final status in [400, 403, 404, 409, 422]) {
    test('$status : clé régénérée après un refus définitif', () async {
      final keys = <String>[];
      var first = true;
      final probe = _Probe((key) async {
        keys.add(key);
        if (first) {
          first = false;
          throw problem(status, 'refused', 'Refusé.');
        }
      });
      await probe.send();
      await probe.send();
      expect(keys[0], isNot(keys[1]));
    });
  }

  test(
    'une demande différente n’hérite pas de la clé de la précédente',
    () async {
      final keys = <String>[];
      final probe = _Probe((key) async {
        keys.add(key);
        throw networkFailure();
      });
      await probe.send('a');
      await probe.send('b');
      expect(keys[0], isNot(keys[1]));
    },
  );

  test(
    'double soumission : la seconde est ignorée, une seule requête',
    () async {
      final gate = Completer<void>();
      var sent = 0;
      final probe = _Probe((_) async {
        sent++;
        await gate.future;
      });
      final first = probe.send();
      expect(probe.busy, isTrue);
      expect(await probe.send(), isA<WriteIgnored>());
      gate.complete();
      expect(await first, isA<WriteDone>());
      expect(sent, 1);
      expect(probe.busy, isFalse);
    },
  );

  test(
    'refus : message du serveur, statut et erreurs de champs conservés',
    () async {
      final probe = _Probe((_) async {
        throw problem(
          422,
          'validation',
          'Le motif est obligatoire.',
          fieldErrors: {
            'note': ['La note est trop courte.'],
          },
        );
      });
      final result = await probe.send() as WriteRefused;
      expect(result.status, 422);
      expect(result.message, 'Le motif est obligatoire.');
      expect(result.fieldErrors['note'], ['La note est trop courte.']);
    },
  );

  test('429 : le message annonce l’attente demandée par le serveur', () async {
    final probe = _Probe((_) async {
      throw const ApiException(
        statusCode: 429,
        message: 'Trop de requêtes.',
        code: 'too_many_requests',
        retryAfterSeconds: 90,
      );
    });
    final result = await probe.send() as WriteRefused;
    expect(result.message, contains('2 min'));
  });

  test('exception inattendue : message générique, jamais un succès', () async {
    final probe = _Probe((_) async => throw const FormatException('secret'));
    final result = await probe.send() as WriteRefused;
    expect(result.message, AsyncViewModel.genericFailure);
    expect(result.message, isNot(contains('secret')));
    expect(probe.busy, isFalse);
  });
}
