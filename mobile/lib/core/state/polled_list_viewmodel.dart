import 'package:flutter/foundation.dart';

import '../services/api_exception.dart';
import '../utils/api_error_text.dart';
import '../utils/poller.dart';
import 'async_view_model.dart';
import 'list_page.dart';

/// Liste paginée par curseur, actualisée en tête tant que l'écran est visible.
/// La liste est triée du plus récent au plus ancien selon [sortKey] ; une
/// actualisation remplace la tête et garde les pages plus anciennes déjà
/// chargées. Aucun échec n'est silencieux : [pollNotice] et [loadMoreError]
/// portent le message à afficher.
abstract class PolledListViewModel<T>({
  super.logger,
  final Duration pollInterval = const Duration(seconds: 30),
}) extends AsyncViewModel<ListPage<T>> {
  Poller? _poller;
  bool _active = false;
  bool _wasPaused = false;
  bool _loadingMore = false;
  int _generation = 0;
  String? _pollNotice;
  String? _loadMoreError;

  bool get loadingMore => _loadingMore;
  String? get pollNotice => _pollNotice;
  String? get loadMoreError => _loadMoreError;

  List<T> get items => state.dataOrNull?.items ?? const [];

  bool get enabled => true;

  Future<ListPage<T>> fetchPage(String? cursor);

  String idOf(T item);

  DateTime sortKey(T item);

  @override
  String messageFor(ApiException error) => ApiErrorText.of(error);

  @override
  Future<ListPage<T>> fetch() async {
    if (!enabled) return ListPage<T>(items: const [], nextCursor: null);
    final generation = ++_generation;
    _pollNotice = null;
    _loadMoreError = null;
    final page = await fetchPage(null);
    if (generation != _generation) {
      throw const ApiException(
        statusCode: null,
        message: 'Requête annulée.',
        cancelled: true,
      );
    }
    return page;
  }

  Future<void> loadMore() async {
    final current = state.dataOrNull;
    final cursor = current?.nextCursor;
    if (!enabled || current == null || cursor == null || _loadingMore) return;
    _loadingMore = true;
    _loadMoreError = null;
    notifySafely();
    final generation = _generation;
    try {
      final next = await fetchPage(cursor);
      if (generation == _generation) {
        final known = {for (final item in current.items) idOf(item)};
        replaceData(
          ListPage<T>(
            items: [
              ...current.items,
              ...next.items.where((item) => !known.contains(idOf(item))),
            ],
            nextCursor: next.nextCursor,
          ),
        );
      }
    } on ApiException catch (error) {
      _loadMoreError = ApiErrorText.of(error);
    } on Exception catch (error, stack) {
      logger.error('Page suivante impossible', error: error, stack: stack);
      _loadMoreError = AsyncViewModel.genericFailure;
    } finally {
      _loadingMore = false;
      notifySafely();
    }
  }

  void setActive(bool active) {
    if (active == _active) return;
    _active = active;
    if (!active) {
      _wasPaused = true;
      _poller?.stop();
      return;
    }
    final poller = _poller ??= Poller(
      pollInterval,
      _refreshHead,
      onFailure: _onPollFailure,
    );
    poller.start(immediately: _wasPaused && state.dataOrNull != null);
  }

  @override
  void resetForKeyChange() {
    _generation++;
    _loadingMore = false;
    resetContext();
  }

  /// Un changement de contexte (profil, filtre) repart d'une page neuve.
  @protected
  void resetContext() {
    _pollNotice = null;
    _loadMoreError = null;
  }

  Future<void> _refreshHead() async {
    final current = state.dataOrNull;
    if (!enabled || current == null || state.isLoading) return;
    final generation = _generation;
    final fresh = await fetchPage(null);
    if (generation != _generation) return;
    final freshIds = {for (final item in fresh.items) idOf(item)};
    final oldest = fresh.items.isEmpty ? null : sortKey(fresh.items.last);
    final older = fresh.hasMore && oldest != null
        ? current.items.where(
            (item) =>
                !freshIds.contains(idOf(item)) &&
                !sortKey(item).isAfter(oldest),
          )
        : const <Never>[];
    _pollNotice = null;
    replaceData(
      ListPage<T>(
        items: [...fresh.items, ...older],
        nextCursor: older.isEmpty ? fresh.nextCursor : current.nextCursor,
      ),
    );
  }

  void _onPollFailure(Object error, {required bool isFinal}) {
    if (error is ApiException) {
      _pollNotice = ApiErrorText.of(error);
    } else {
      logger.error('Actualisation impossible', error: error);
      _pollNotice = AsyncViewModel.genericFailure;
    }
    notifySafely();
  }

  @override
  void dispose() {
    _poller?.stop();
    super.dispose();
  }
}
