import 'package:intl/intl.dart';

abstract final class Formatters() {
  static const locale = 'fr_FR';
  static const _zeroDecimalCurrencies = {'XOF', 'XAF', 'JPY'};

  static int decimalsFor(String currency) =>
      _zeroDecimalCurrencies.contains(currency) ? 0 : 2;

  /// Les montants circulent en unités mineures (entiers) : jamais de double
  /// stocké. La division n'a lieu qu'à l'affichage.
  static String money(int minorUnits, {required String currency}) {
    final decimals = decimalsFor(currency);
    return NumberFormat.currency(
      locale: locale,
      name: currency,
      decimalDigits: decimals,
    ).format(minorUnits / _pow10(decimals));
  }

  /// « 74 € » quand le montant est rond, « 74,50 € » sinon.
  static String moneyCompact(int minorUnits, {required String currency}) {
    final decimals = decimalsFor(currency);
    final factor = _pow10(decimals);
    final rounded = minorUnits % factor == 0;
    return NumberFormat.currency(
      locale: locale,
      name: currency,
      decimalDigits: rounded ? 0 : decimals,
    ).format(minorUnits / factor);
  }

  static String dateLong(DateTime date) =>
      DateFormat.yMMMd(locale).format(date);

  /// « novembre 2026 » (premier caractère en capitale).
  static String monthYear(DateTime date) {
    final text = DateFormat.yMMMM(locale).format(date);
    return '${text[0].toUpperCase()}${text.substring(1)}';
  }

  static String dateTime(DateTime value) =>
      DateFormat('d MMM yyyy à HH:mm', locale).format(value);

  /// Heure le jour même, sinon jour et mois (année si elle diffère).
  static String shortDateTime(DateTime value, {required DateTime now}) {
    final local = value.toLocal();
    if (local.year == now.year &&
        local.month == now.month &&
        local.day == now.day) {
      return DateFormat.Hm(locale).format(local);
    }
    return local.year == now.year
        ? DateFormat('d MMM', locale).format(local)
        : DateFormat('d MMM yyyy', locale).format(local);
  }

  static String fileSize(int bytes) {
    if (bytes < 1024) return '$bytes o';
    if (bytes < 1024 * 1024) return '${(bytes / 1024).round()} Ko';
    return '${NumberFormat('0.#', locale).format(bytes / (1024 * 1024))} Mo';
  }

  static String dateRange(DateTime start, DateTime end) {
    if (start.year == end.year && start.month == end.month) {
      return '${start.day} au ${DateFormat.yMMMd(locale).format(end)}';
    }
    if (start.year == end.year) {
      return '${DateFormat.MMMd(locale).format(start)} au '
          '${DateFormat.yMMMd(locale).format(end)}';
    }
    return '${dateLong(start)} au ${dateLong(end)}';
  }

  static String isoDate(DateTime date) =>
      '${date.year.toString().padLeft(4, '0')}-'
      '${date.month.toString().padLeft(2, '0')}-'
      '${date.day.toString().padLeft(2, '0')}';

  static int _pow10(int exponent) {
    var result = 1;
    for (var i = 0; i < exponent; i++) {
      result *= 10;
    }
    return result;
  }
}
