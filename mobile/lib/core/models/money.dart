import '../utils/formatters.dart';
import '../utils/json_reader.dart';

/// Montant de l'API : `{amount, currency}`, `amount` en unités mineures ;
/// la devise est celle du serveur, jamais supposée côté application.
class const Money(final int minor, final String currency) {
  factory Money.fromJson(Map<String, Object?> json, String key) {
    final money = Json.child(json, key);
    return Money(Json.integer(money, 'amount'), Json.string(money, 'currency'));
  }

  static Money? fromJsonOrNull(Map<String, Object?> json, String key) =>
      json[key] == null ? null : Money.fromJson(json, key);

  String get text => Formatters.money(minor, currency: currency);

  bool get isZero => minor == 0;

  Money operator +(Money other) {
    if (other.currency != currency) {
      throw ArgumentError(
        'Devises différentes : $currency et ${other.currency}',
      );
    }
    return Money(minor + other.minor, currency);
  }

  @override
  bool operator ==(Object other) =>
      other is Money && other.minor == minor && other.currency == currency;

  @override
  int get hashCode => Object.hash(minor, currency);
}
