import 'dart:developer' as developer;

import 'package:flutter/foundation.dart';

typedef ErrorReporter = void Function(
  Object error,
  StackTrace? stack, {
  required bool fatal,
});

class const AppLogger({
  final ErrorReporter? reporter,
  final bool enabled = kDebugMode,
}) {
  static const _name = 'eguardimmo';

  void info(String message) => _write(message, level: 800);

  void warning(String message, {Object? error}) =>
      _write(message, level: 900, error: error);

  void error(String message, {Object? error, StackTrace? stack}) {
    _write(message, level: 1000, error: error, stack: stack);
    if (error != null) reporter?.call(error, stack, fatal: false);
  }

  void installGlobalHandlers() {
    final previous = FlutterError.onError;
    FlutterError.onError = (details) {
      if (previous != null) {
        previous(details);
      } else if (enabled) {
        FlutterError.presentError(details);
      }
      _write(
        details.exceptionAsString(),
        level: 1200,
        error: details.exception,
        stack: details.stack,
      );
      reporter?.call(details.exception, details.stack, fatal: true);
    };
    PlatformDispatcher.instance.onError = (error, stack) {
      _write(
        'Erreur asynchrone non gérée',
        level: 1200,
        error: error,
        stack: stack,
      );
      reporter?.call(error, stack, fatal: true);
      return true;
    };
  }

  void _write(
    String message, {
    required int level,
    Object? error,
    StackTrace? stack,
  }) {
    if (!enabled) return;
    developer.log(
      message,
      name: _name,
      level: level,
      error: error,
      stackTrace: stack,
    );
  }
}
