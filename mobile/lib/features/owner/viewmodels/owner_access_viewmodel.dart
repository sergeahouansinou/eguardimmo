import '../../../core/state/async_view_model.dart';
import '../models/owner_access.dart';
import '../services/owner_service.dart';

/// Accès du propriétaire connecté, un par agence. Une instance par
/// utilisateur : le provider en recrée une au changement de compte, sans
/// jamais montrer les accès du précédent.
class OwnerAccessViewModel(
  final OwnerService _service, {
  required final String? userId,
  super.logger,
}) extends AsyncViewModel<List<OwnerAccess>> {
  String? _selectedId;

  List<OwnerAccess> get accesses => state.dataOrNull ?? const [];

  OwnerAccess? get selected {
    for (final access in accesses) {
      if (access.accessId == _selectedId) return access;
    }
    return accesses.firstOrNull;
  }

  @override
  void resetForKeyChange() => _selectedId = null;

  void select(OwnerAccess access) {
    if (access.accessId == selected?.accessId) return;
    _selectedId = access.accessId;
    notifySafely();
  }

  void ensureLoaded() {
    if (userId != null && state.dataOrNull == null && !state.isLoading) {
      load();
    }
  }

  @override
  Future<List<OwnerAccess>> fetch() => _service.agencies();
}
