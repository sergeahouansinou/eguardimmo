import '../../../core/services/api_exception.dart';
import '../../../core/state/async_view_model.dart';
import '../services/marketplace_service.dart';

class FavoritesViewModel(final MarketplaceService _service, {super.logger})
    extends AsyncViewModel<Set<String>> {
  final Set<String> _pending = {};

  bool isFavorite(String ref) => state.dataOrNull?.contains(ref) ?? false;

  bool isPending(String ref) => _pending.contains(ref);

  @override
  Future<Set<String>> fetch() => _service.favoriteRefs();

  /// Bascule optimiste ; renvoie un message d'erreur et rétablit l'état
  /// précédent si le serveur refuse ou reste injoignable.
  Future<String?> toggle(String ref) async {
    final current = state.dataOrNull;
    if (current == null || !_pending.add(ref)) {
      return current == null
          ? 'Vos favoris ne sont pas chargés. Réessayez dans un instant.'
          : null;
    }
    final adding = !current.contains(ref);
    replaceData(adding ? {...current, ref} : ({...current}..remove(ref)));
    try {
      if (adding) {
        await _service.addFavorite(ref);
      } else {
        await _service.removeFavorite(ref);
      }
      return null;
    } on ApiException catch (error) {
      replaceData(current);
      return error.message;
    } on Exception catch (error, stack) {
      logger.error('Favori impossible', error: error, stack: stack);
      replaceData(current);
      return AsyncViewModel.genericFailure;
    } finally {
      _pending.remove(ref);
    }
  }
}
