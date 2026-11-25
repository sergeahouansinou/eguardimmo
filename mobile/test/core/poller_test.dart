import 'dart:async';

import 'package:eguardimmo/core/services/api_exception.dart';
import 'package:eguardimmo/core/utils/poller.dart';
import 'package:flutter_test/flutter_test.dart';

ApiException failure(int status, {int? retryAfter}) => ApiException(
  statusCode: status,
  message: 'échec',
  retryAfterSeconds: retryAfter,
);

void main() {
  const interval = Duration(seconds: 10);

  Duration seconds(int value) => Duration(seconds: value);

  testWidgets('interroge à chaque échéance', (tester) async {
    var ticks = 0;
    final poller = Poller(interval, () async => ticks += 1)..start();
    await tester.pump(seconds(9));
    expect(ticks, 0);
    await tester.pump(seconds(1));
    expect(ticks, 1);
    await tester.pump(seconds(10));
    await tester.pump(seconds(10));
    expect(ticks, 3);
    poller.stop();
  });

  testWidgets('immediately lance une interrogation sans attendre', (
    tester,
  ) async {
    var ticks = 0;
    final poller = Poller(interval, () async => ticks += 1)
      ..start(immediately: true);
    await tester.pump(Duration.zero);
    expect(ticks, 1);
    poller.stop();
  });

  testWidgets('la prochaine échéance attend la fin de l’interrogation', (
    tester,
  ) async {
    var ticks = 0;
    final gate = Completer<void>();
    final poller = Poller(interval, () async {
      ticks += 1;
      await gate.future;
    })..start();
    await tester.pump(seconds(10));
    await tester.pump(seconds(60));
    expect(ticks, 1);
    gate.complete();
    await tester.pump();
    await tester.pump(interval);
    expect(ticks, 2);
    poller.stop();
  });

  testWidgets('stop annule l’échéance', (tester) async {
    var ticks = 0;
    Poller(interval, () async => ticks += 1)
      ..start()
      ..stop();
    await tester.pump(const Duration(minutes: 5));
    expect(ticks, 0);
  });

  testWidgets('un échec recule de façon exponentielle puis se rétablit', (
    tester,
  ) async {
    var ticks = 0;
    var failing = true;
    final errors = <Object>[];
    final poller = Poller(interval, () async {
      ticks += 1;
      if (failing) throw failure(503);
    }, onFailure: (error, {required isFinal}) => errors.add(error))..start();
    await tester.pump(interval);
    expect(ticks, 1);
    await tester.pump(seconds(19));
    expect(ticks, 1);
    await tester.pump(seconds(1));
    expect(ticks, 2);
    failing = false;
    await tester.pump(seconds(40));
    expect(ticks, 3);
    await tester.pump(interval);
    expect(ticks, 4);
    expect(errors, hasLength(2));
    poller.stop();
  });

  testWidgets('le recul est plafonné à 5 minutes', (tester) async {
    var ticks = 0;
    final poller = Poller(interval, () async {
      ticks += 1;
      throw failure(503);
    })..start();
    for (var elapsed = 0; elapsed < 3600; elapsed += 10) {
      await tester.pump(interval);
    }
    expect(ticks, 15);
    poller.stop();
  });

  test('Retry-After allonge l’attente, sans être plafonné', () {
    final poller = Poller(interval, () async {});
    expect(poller.delayAfterFailure(failure(429, retryAfter: 90)), seconds(90));
    expect(
      poller.delayAfterFailure(failure(429, retryAfter: 9000)),
      seconds(9000),
    );
  });

  test('sans Retry-After, le recul exponentiel reste plafonné', () {
    final poller = Poller(interval, () async {});
    expect(
      poller.delayAfterFailure(failure(500)),
      lessThanOrEqualTo(const Duration(minutes: 5)),
    );
  });

  for (final status in [401, 403, 404]) {
    testWidgets('$status arrête l’interrogation et le signale définitif', (
      tester,
    ) async {
      var ticks = 0;
      bool? reportedFinal;
      final poller = Poller(
        interval,
        () async {
          ticks += 1;
          throw failure(status);
        },
        onFailure: (error, {required isFinal}) => reportedFinal = isFinal,
      )..start();
      await tester.pump(interval);
      await tester.pump(const Duration(minutes: 10));
      expect(ticks, 1);
      expect(poller.running, isFalse);
      expect(reportedFinal, isTrue);
    });
  }
}
