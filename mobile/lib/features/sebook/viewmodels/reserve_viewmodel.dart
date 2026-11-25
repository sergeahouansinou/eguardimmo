import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart' show DateTimeRange;

import '../../../core/services/api_exception.dart';
import '../../../core/services/app_logger.dart';
import '../../../core/utils/idempotency_key.dart';
import '../models/listing.dart';
import '../models/quote.dart';
import '../services/bookings_service.dart';
import '../services/marketplace_service.dart';

class ReserveViewModel(
  final MarketplaceService _market,
  final BookingsService _bookings,
  final ListingDetail listing, {
  final AppLogger _logger = const AppLogger(),
  DateTime Function()? now,
}) extends ChangeNotifier {
  this : _now = now ?? DateTime.now;

  static const _genericFailure =
      'La réservation n’a pas pu aboutir. Réessayez dans un instant.';
  static const datesTaken =
      'Ces dates ne sont pas disponibles. Choisissez d’autres dates.';
  static const availabilityUnverified =
      'Les disponibilités n’ont pas pu être vérifiées : le serveur les contrôlera à la réservation.';
  static const windowDays = 366;

  final DateTime Function() _now;
  List<OccupiedRange>? _occupied;
  String? _availabilityNotice;

  DateTimeRange? _range;
  int _guests = 1;
  Quote? _quote;
  bool _quoting = false;
  bool _booking = false;
  bool _created = false;
  bool _disposed = false;
  String? _error;
  String _idempotencyKey = IdempotencyKey.generate();
  int _quoteRun = 0;

  DateTimeRange? get range => _range;
  int get guests => _guests;
  Quote? get quote => _quote;
  bool get quoting => _quoting;
  bool get booking => _booking;
  bool get created => _created;
  String? get error => _error;
  bool get canConfirm => _quote != null && !_quoting && !_booking && !_created;
  int get maxGuests => listing.summary.capacity;
  List<OccupiedRange> get occupied => _occupied ?? const [];
  String? get availabilityNotice => _availabilityNotice;

  /// Premier jour réservable : demain ; la fenêtre de disponibilités et le
  /// calendrier s'arrêtent 365 jours plus tard.
  DateTime get firstDay {
    final today = _now();
    return DateTime(today.year, today.month, today.day + 1);
  }

  DateTime get lastDay =>
      DateTime(firstDay.year, firstDay.month, firstDay.day + windowDays - 1);

  Future<void> loadAvailability() async {
    try {
      final from = firstDay;
      final ranges = await _market.availability(
        listing.summary.ref,
        from: from,
        to: DateTime(from.year, from.month, from.day + windowDays),
      );
      _occupied = ranges;
    } on ApiException {
      _availabilityNotice = availabilityUnverified;
    } on Exception catch (error, stack) {
      _logger.error('Disponibilités illisibles', error: error, stack: stack);
      _availabilityNotice = availabilityUnverified;
    } finally {
      _notify();
    }
  }

  Future<void> setRange(DateTimeRange value) {
    _range = value;
    return _refreshQuote();
  }

  Future<void> setGuests(int value) {
    if (value < 1 || value > maxGuests || value == _guests) {
      return Future<void>.value();
    }
    _guests = value;
    return _range == null ? Future<void>.value() : _refreshQuote();
  }

  Future<void> _refreshQuote() async {
    final range = _range;
    if (range == null) return;
    _idempotencyKey = IdempotencyKey.generate();
    _quote = null;
    _error = null;
    final nights = range.duration.inDays;
    if (nights < listing.minNights) {
      _error =
          'Séjour minimum : ${listing.minNights} nuit${listing.minNights > 1 ? 's' : ''}.';
      _notify();
      return;
    }
    if (occupied.any((taken) => taken.overlaps(range.start, range.end))) {
      _error = datesTaken;
      _notify();
      return;
    }
    final run = ++_quoteRun;
    _quoting = true;
    _notify();
    try {
      final quote = await _market.quote(
        listing.summary.ref,
        checkIn: range.start,
        checkOut: range.end,
        guests: _guests,
      );
      if (run == _quoteRun) {
        if (quote.available) {
          _quote = quote;
        } else {
          _error = datesTaken;
        }
      }
    } on ApiException catch (error) {
      if (run == _quoteRun) _error = error.message;
    } on Exception catch (error, stack) {
      _logger.error('Devis impossible', error: error, stack: stack);
      if (run == _quoteRun) _error = _genericFailure;
    } finally {
      if (run == _quoteRun) _quoting = false;
      _notify();
    }
  }

  Future<void> confirm() async {
    final range = _range;
    if (!canConfirm || range == null) return;
    _booking = true;
    _error = null;
    _notify();
    try {
      await _bookings.create(
        listingRef: listing.summary.ref,
        checkIn: range.start,
        checkOut: range.end,
        guests: _guests,
        idempotencyKey: _idempotencyKey,
      );
      _created = true;
    } on ApiException catch (error) {
      _error = error.code == 'dates_unavailable'
          ? 'Ces dates ne sont plus disponibles. Choisissez d’autres dates.'
          : error.message;
      if (error.code == 'dates_unavailable') unawaited(loadAvailability());
    } on Exception catch (error, stack) {
      _logger.error('Réservation impossible', error: error, stack: stack);
      _error = _genericFailure;
    } finally {
      _booking = false;
      _notify();
    }
  }

  void _notify() {
    if (!_disposed) notifyListeners();
  }

  @override
  void dispose() {
    _disposed = true;
    super.dispose();
  }
}
