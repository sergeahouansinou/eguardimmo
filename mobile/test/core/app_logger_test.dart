import 'package:eguardimmo/core/services/app_logger.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test('error transmet l’exception au reporter, non fatale', () {
    final reported = <(Object, bool)>[];
    final logger = AppLogger(
      reporter: (error, stack, {required fatal}) =>
          reported.add((error, fatal)),
    );
    final failure = StateError('panne');
    logger.error('échec', error: failure);
    expect(reported, [(failure, false)]);
  });

  test('journal coupé (release) : l’erreur reste transmise au reporter', () {
    final reported = <(Object, bool)>[];
    final logger = AppLogger(
      enabled: false,
      reporter: (error, stack, {required fatal}) =>
          reported.add((error, fatal)),
    );
    final failure = StateError('panne');
    logger
      ..info('information')
      ..warning('alerte', error: failure)
      ..error('échec', error: failure);
    expect(reported, [(failure, false)]);
  });

  test('error sans exception ne remonte rien', () {
    var calls = 0;
    AppLogger(reporter: (_, _, {required fatal}) => calls++)
        .error('message seul');
    expect(calls, 0);
  });

  test(
    'les erreurs Flutter sont rapportées comme fatales, sans être avalées',
    () {
      final original = FlutterError.onError;
      final presented = <FlutterErrorDetails>[];
      FlutterError.onError = presented.add;
      addTearDown(() => FlutterError.onError = original);
      final reported = <(Object, bool)>[];
      AppLogger(
        reporter: (error, stack, {required fatal}) =>
            reported.add((error, fatal)),
      ).installGlobalHandlers();

      final failure = StateError('rendu');
      FlutterError.onError!(FlutterErrorDetails(exception: failure));

      expect(presented, hasLength(1));
      expect(reported, [(failure, true)]);
    },
  );

  test('les erreurs asynchrones non gérées sont rapportées et considérées traitées', () {
    final original = PlatformDispatcher.instance.onError;
    addTearDown(() => PlatformDispatcher.instance.onError = original);
    final reported = <(Object, bool)>[];
    AppLogger(
      reporter: (error, stack, {required fatal}) =>
          reported.add((error, fatal)),
    ).installGlobalHandlers();

    final failure = StateError('async');
    final handled = PlatformDispatcher.instance.onError!(
      failure,
      StackTrace.empty,
    );

    expect(handled, isTrue);
    expect(reported, [(failure, true)]);
  });
}
