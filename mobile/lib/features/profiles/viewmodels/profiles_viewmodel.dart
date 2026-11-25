import '../../../core/state/async_view_model.dart';
import '../models/app_profile.dart';
import '../services/profiles_service.dart';

class ProfilesViewModel(final ProfilesService _service, {super.logger})
    extends AsyncViewModel<List<AppProfile>> {
  String _activeId = AppProfile.traveler.id;

  List<AppProfile> get profiles =>
      state.dataOrNull ?? const [AppProfile.traveler];

  AppProfile get active => profiles.firstWhere(
    (profile) => profile.id == _activeId,
    orElse: () => AppProfile.traveler,
  );

  @override
  Future<List<AppProfile>> fetch() => _service.fetch();

  void select(AppProfile profile) {
    _activeId = profile.id;
    notifyListeners();
  }

  @override
  void resetForKeyChange() => _activeId = AppProfile.traveler.id;
}
