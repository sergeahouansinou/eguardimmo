import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';

import '../../../core/services/api_exception.dart';
import '../../../core/services/app_logger.dart';
import '../models/place.dart';
import '../services/marketplace_service.dart';

enum PlaceSearchStatus() {
  idle,
  loading,
  results,
  failed,
}

class PlaceSearchViewModel(
  final MarketplaceService _service, {
  final Duration debounce = const Duration(milliseconds: 300),
  final AppLogger _logger = const AppLogger(),
}) extends ChangeNotifier {
  static const minLength = 2;
  static const maxLength = 80;
  static const _genericFailure = 'Recherche de lieux indisponible. Réessayez.';

  Timer? _timer;
  CancelToken? _inFlight;
  bool _disposed = false;
  String _query = '';
  PlaceSearchStatus _status = PlaceSearchStatus.idle;
  List<Place> _places = const [];
  String? _failure;

  PlaceSearchStatus get status => _status;
  List<Place> get places => _places;
  String? get failure => _failure;

  void onChanged(String text) {
    final query = text.trim();
    if (query == _query) return;
    _query = query;
    _timer?.cancel();
    _inFlight?.cancel();
    if (query.length < minLength || query.length > maxLength) {
      _set(PlaceSearchStatus.idle, const []);
      return;
    }
    _set(PlaceSearchStatus.loading, _places);
    _timer = Timer(debounce, () => unawaited(_search(query)));
  }

  void retry() {
    final query = _query;
    if (query.length < minLength) return;
    _set(PlaceSearchStatus.loading, _places);
    unawaited(_search(query));
  }

  void clear() {
    _query = '';
    _timer?.cancel();
    _inFlight?.cancel();
    _set(PlaceSearchStatus.idle, const []);
  }

  Future<void> _search(String query) async {
    final token = _inFlight = CancelToken();
    try {
      final places = await _service.places(query, cancelToken: token);
      if (query == _query) _set(PlaceSearchStatus.results, places);
    } on ApiException catch (error) {
      if (!error.cancelled && query == _query) {
        _set(PlaceSearchStatus.failed, const [], failure: error.message);
      }
    } on Exception catch (error, stack) {
      _logger.error(
        'Recherche de lieux impossible',
        error: error,
        stack: stack,
      );
      if (query == _query) {
        _set(PlaceSearchStatus.failed, const [], failure: _genericFailure);
      }
    }
  }

  void _set(PlaceSearchStatus status, List<Place> places, {String? failure}) {
    if (_disposed) return;
    _status = status;
    _places = places;
    _failure = failure;
    notifyListeners();
  }

  @override
  void dispose() {
    _disposed = true;
    _timer?.cancel();
    _inFlight?.cancel();
    super.dispose();
  }
}
