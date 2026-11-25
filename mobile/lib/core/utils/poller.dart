import 'dart:async';
import 'dart:math';

import '../services/api_exception.dart';

/// Interrogation périodique sans chevauchement : la prochaine échéance est
/// planifiée quand la précédente est terminée. Un échec recule de façon
/// exponentielle (5 min au plus) et respecte `Retry-After` sans le plafonner ; 401, 403 et 404
/// sont définitifs, l'interrogation s'arrête et l'échec est signalé.
class Poller(
  final Duration _interval,
  final Future<void> Function() _tick, {
  final void Function(Object error, {required bool isFinal})? onFailure,
  final void Function()? onSuccess,
  final Duration maxBackoff = const Duration(minutes: 5),
}) {
  Timer? _timer;
  int _failures = 0;
  bool _running = false;
  bool _inFlight = false;

  bool get running => _running;

  void start({bool immediately = false}) {
    if (_running) return;
    _running = true;
    _failures = 0;
    _schedule(immediately ? Duration.zero : _interval);
  }

  void stop() {
    _running = false;
    _timer?.cancel();
    _timer = null;
  }

  Duration delayAfterFailure(Object error) {
    final backoff = _interval * pow(2, _failures).toInt();
    final capped = backoff > maxBackoff ? maxBackoff : backoff;
    final wait = error is ApiException && error.retryAfterSeconds != null
        ? Duration(seconds: error.retryAfterSeconds!)
        : Duration.zero;
    return wait > capped ? wait : capped;
  }

  void _schedule(Duration delay) {
    _timer?.cancel();
    _timer = Timer(delay, _run);
  }

  Future<void> _run() async {
    if (!_running || _inFlight) return;
    _inFlight = true;
    try {
      await _tick();
      _failures = 0;
      onSuccess?.call();
      if (_running) _schedule(_interval);
    } on Exception catch (error) {
      if (!_running) return;
      final fatal = error is ApiException && _isFinal(error);
      onFailure?.call(error, isFinal: fatal);
      if (fatal) {
        stop();
      } else {
        _failures++;
        _schedule(delayAfterFailure(error));
      }
    } finally {
      _inFlight = false;
    }
  }

  static bool _isFinal(ApiException error) =>
      error.isUnauthorized || error.isForbidden || error.isNotFound;
}
