import '../../../core/services/api_exception.dart';
import '../../../core/state/async_view_model.dart';
import '../../../core/utils/api_error_text.dart';
import '../models/support_availability.dart';
import '../services/support_service.dart';

class SupportAvailabilityViewModel(
  final SupportService _service, {
  super.logger,
}) extends AsyncViewModel<SupportAvailability> {
  @override
  String messageFor(ApiException error) => ApiErrorText.of(error);

  @override
  Future<SupportAvailability> fetch() => _service.status();
}
