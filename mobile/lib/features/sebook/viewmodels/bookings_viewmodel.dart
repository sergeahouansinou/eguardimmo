import '../../../core/services/api_exception.dart';
import '../../../core/state/async_view_model.dart';
import '../models/booking.dart';
import '../models/money.dart';
import '../services/bookings_service.dart';

class const CancelOutcome({final String? error, final Money? refund}) {
  bool get succeeded => error == null;
}

class BookingsViewModel(
  final BookingsService _service, {
  super.logger,
  DateTime Function()? now,
}) extends AsyncViewModel<List<Booking>> {
  this : _now = now ?? DateTime.now;

  final DateTime Function() _now;
  final Set<String> _cancelling = {};

  DateTime get today {
    final now = _now();
    return DateTime(now.year, now.month, now.day);
  }

  List<Booking> get upcoming => _sorted(
    (state.dataOrNull ?? const []).where((b) => b.isUpcoming(today)),
    ascending: true,
  );

  List<Booking> get past => _sorted(
    (state.dataOrNull ?? const []).where((b) => !b.isUpcoming(today)),
    ascending: false,
  );

  bool isCancelling(String id) => _cancelling.contains(id);

  @override
  Future<List<Booking>> fetch() => _service.list();

  Future<CancelOutcome> cancel(Booking booking) async {
    if (!_cancelling.add(booking.id)) return const CancelOutcome();
    notifySafely();
    try {
      final updated = await _service.cancel(booking.id);
      final current = state.dataOrNull;
      if (current != null) {
        replaceData([
          for (final entry in current) entry.id == updated.id ? updated : entry,
        ]);
      }
      return CancelOutcome(refund: updated.refund);
    } on ApiException catch (error) {
      return CancelOutcome(error: error.message);
    } on Exception catch (error, stack) {
      logger.error('Annulation impossible', error: error, stack: stack);
      return const CancelOutcome(error: AsyncViewModel.genericFailure);
    } finally {
      _cancelling.remove(booking.id);
      notifySafely();
    }
  }

  List<Booking> _sorted(Iterable<Booking> bookings, {required bool ascending}) {
    final list = bookings.toList()
      ..sort((a, b) => a.checkIn.compareTo(b.checkIn));
    return ascending ? list : list.reversed.toList();
  }
}
