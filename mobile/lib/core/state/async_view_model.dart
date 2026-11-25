import 'dart:async';

import 'package:flutter/foundation.dart';

import '../services/api_exception.dart';
import '../services/app_logger.dart';
import '../utils/cursor_pages.dart';
import 'load_state.dart';

/// Un ViewModel de chargement : trois états explicites (chargement, données,
/// échec) et aucune panne avalée. Un ApiException devient un message pour
/// l'utilisateur ; toute autre Exception est journalisée puis affichée en
/// message générique ; les Error (bogues) remontent au gestionnaire global.
abstract class AsyncViewModel<T>({final AppLogger _logger = const AppLogger()})
    extends ChangeNotifier {
  static const genericFailure =
      'Une erreur est survenue. Réessayez dans un instant.';

  LoadState<T> _state = const Idle();
  bool _disposed = false;
  String? _boundKey;
  int _loadTicket = 0;

  LoadState<T> get state => _state;

  @protected
  AppLogger get logger => _logger;

  @protected
  Future<T> fetch();

  @protected
  String messageFor(ApiException error) => error.message;

  /// `keepPrevious: false` : un changement de contexte (filtre, type de liste)
  /// ne doit pas afficher les données de l'ancien contexte pendant l'attente.
  /// Seule la dernière demande publie son résultat : une réponse tardive d'un
  /// contexte précédent est ignorée.
  Future<void> load({bool keepPrevious = true}) async {
    final previous = keepPrevious ? _state.dataOrNull : null;
    final ticket = ++_loadTicket;
    _emit(Loading(previous: previous));
    try {
      final data = await fetch();
      if (ticket == _loadTicket) _emit(Loaded(data));
    } on ApiException catch (error) {
      if (ticket != _loadTicket) return;
      _emit(
        error.cancelled
            ? (previous == null ? const Idle() : Loaded(previous))
            : Failed(
                messageFor(error),
                previous: error.isForbidden || error.isNotFound
                    ? null
                    : previous,
              ),
      );
    } on ListTruncatedException catch (error) {
      _logger.warning('Liste tronquée', error: error);
      if (ticket != _loadTicket) return;
      _emit(Failed(error.message));
    } on Exception catch (error, stack) {
      _logger.error('Chargement impossible', error: error, stack: stack);
      if (ticket != _loadTicket) return;
      _emit(Failed(genericFailure, previous: previous));
    }
  }

  /// Lie le ViewModel à un compte : un changement de clé invalide aussitôt les
  /// données de l'ancien compte (état Idle, chargements en cours ignorés,
  /// contexte remis à zéro), puis recharge (clé non nulle) sans rien
  /// conserver. La notification attend la fin de la phase de construction.
  void bind(String? key) {
    if (key == _boundKey) return;
    _boundKey = key;
    _loadTicket++;
    _state = const Idle();
    resetForKeyChange();
    scheduleMicrotask(() {
      if (_disposed || key != _boundKey) return;
      if (key == null) {
        _emit(const Idle());
      } else {
        unawaited(load(keepPrevious: false));
      }
    });
  }

  @protected
  void resetForKeyChange() {}

  @protected
  void notifySafely() {
    if (!_disposed) notifyListeners();
  }

  @protected
  void replaceData(T data) {
    _loadTicket++;
    _emit(Loaded(data));
  }

  void _emit(LoadState<T> next) {
    if (_disposed) return;
    _state = next;
    notifyListeners();
  }

  @override
  void dispose() {
    _disposed = true;
    super.dispose();
  }
}
