import '../../../core/models/money.dart';
import '../../../core/utils/json_reader.dart';

enum UnitState(final String label) {
  vacant('Vacant'),
  occupied('Occupé'),
  late('Loyer en retard');

  static UnitState parse(String value) => switch (value) {
    'vacant' => vacant,
    'occupied' => occupied,
    'late' => late,
    _ => throw FormatException('État de lot inconnu : $value'),
  };
}

const _payoutNotices = {
  'no_payout_account': 'Aucun compte de versement n’est enregistré : renseignez-le pour recevoir vos reversements.',
  'account_recently_changed': 'Votre compte de versement a changé récemment : le prochain reversement attend la fin du délai de sécurité.',
  'below_minimum':
      'Le montant à reverser n’atteint pas encore le minimum de versement.',
  'before_payout_day':
      'Le jour de reversement de votre mandat n’est pas encore arrivé.',
};

String payoutNoticeLabel(String code) =>
    _payoutNotices[code] ??
    'Votre agence examine ce reversement : il peut être décalé. Contactez-la pour en savoir plus.';

class const HomeUnit({
  required final String id,
  required final String label,
  required final UnitState state,
  required final Money collected,
  final String? tenantName,
  final Money? rent,
}) {
  factory HomeUnit.fromJson(Map<String, Object?> json) {
    final tenant = Json.childOrNull(json, 'tenant');
    return HomeUnit(
      id: Json.string(json, 'id'),
      label: Json.string(json, 'label'),
      state: UnitState.parse(Json.string(json, 'state')),
      collected: Money.fromJson(json, 'collected'),
      tenantName: tenant == null ? null : Json.string(tenant, 'name'),
      rent: Money.fromJsonOrNull(json, 'rent'),
    );
  }
}

class const PendingPayout({
  required final Money net,
  required final Money fees,
}) {
  factory PendingPayout.fromJson(Map<String, Object?> json) => PendingPayout(
    net: Money.fromJson(json, 'net'),
    fees: Money.fromJson(json, 'fees'),
  );
}

class const LastPayout({
  required final Money amount,
  final DateTime? date,
  final String? number,
}) {
  factory LastPayout.fromJson(Map<String, Object?> json) => LastPayout(
    amount: Money.fromJson(json, 'amount'),
    date: json['date'] == null ? null : Json.day(json, 'date'),
    number: Json.stringOrNull(json, 'number'),
  );
}

class const HomePayouts({
  final PendingPayout? pending,
  final LastPayout? last,
  final DateTime? nextDate,
  final String? nextNotice,
}) {
  factory HomePayouts.fromJson(Map<String, Object?> json) {
    final pending = Json.childOrNull(json, 'pending');
    final last = Json.childOrNull(json, 'last');
    return HomePayouts(
      pending: pending == null ? null : PendingPayout.fromJson(pending),
      last: last == null ? null : LastPayout.fromJson(last),
      nextDate: json['next_date'] == null ? null : Json.day(json, 'next_date'),
      nextNotice: Json.stringOrNull(json, 'next_notice'),
    );
  }
}

class const HomeReport({
  required final String number,
  required final DateTime periodStart,
  required final DateTime periodEnd,
  required final bool isRead,
}) {
  factory HomeReport.fromJson(Map<String, Object?> json) {
    final period = Json.child(json, 'period');
    return HomeReport(
      number: Json.string(json, 'number'),
      periodStart: Json.day(period, 'start'),
      periodEnd: Json.day(period, 'end'),
      isRead: Json.boolean(json, 'is_read'),
    );
  }
}

class const OwnerHome({
  required final String agencyName,
  required final String mandantName,
  required final String role,
  required final DateTime monthStart,
  required final Money called,
  required final Money collected,
  required final Money arrears,
  required final int arrearsCount,
  required final int arrearsMaxDays,
  required final int quotesToDecide,
  required final List<HomeUnit> units,
  final HomePayouts? payouts,
  final HomeReport? lastReport,
}) {
  factory OwnerHome.fromJson(Map<String, Object?> json) {
    final month = Json.child(json, 'month');
    final arrears = Json.child(month, 'arrears');
    final payouts = Json.childOrNull(json, 'payouts');
    final report = Json.childOrNull(json, 'last_report');
    return OwnerHome(
      agencyName:
          Json.stringOrNull(Json.child(json, 'agency'), 'name') ?? 'Agence',
      mandantName: Json.stringOrNull(Json.child(json, 'mandant'), 'name') ?? '',
      role: Json.string(Json.child(json, 'mandant'), 'role'),
      monthStart: Json.day(month, 'from'),
      called: Money.fromJson(month, 'called'),
      collected: Money.fromJson(month, 'collected'),
      arrears: Money.fromJson(arrears, 'amount'),
      arrearsCount: Json.integer(arrears, 'count'),
      arrearsMaxDays: Json.integer(arrears, 'max_days_late'),
      quotesToDecide: Json.integer(
        Json.child(json, 'counters'),
        'quotes_to_decide',
      ),
      units: [
        for (final unit in Json.list(json['units'], 'units'))
          HomeUnit.fromJson(Json.object(unit, 'lot')),
      ],
      payouts: payouts == null ? null : HomePayouts.fromJson(payouts),
      lastReport: report == null ? null : HomeReport.fromJson(report),
    );
  }
}
