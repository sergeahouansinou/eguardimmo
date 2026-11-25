import '../../../core/models/money.dart';
import '../../../core/utils/json_reader.dart';

class const AgencyKpis({
  required final String month,
  required final Money rentCalled,
  required final Money rentCollected,
  required final Money feesNet,
  required final bool periodClosed,
  final int? collectionRateBasisPoints,
}) {
  factory AgencyKpis.fromJson(Map<String, Object?> json) => AgencyKpis(
    month: Json.string(json, 'month'),
    rentCalled: Money.fromJson(json, 'rent_called'),
    rentCollected: Money.fromJson(json, 'rent_collected'),
    feesNet: Money.fromJson(json, 'fees_net'),
    periodClosed: Json.boolean(json, 'period_closed'),
    collectionRateBasisPoints: Json.integerOrNull(
      json,
      'collection_rate_basis_points',
    ),
  );

  DateTime get monthStart {
    final parts = month.split('-');
    return DateTime(int.parse(parts[0]), int.parse(parts[1]));
  }

  /// « 97,1 % » : pourcentage calculé en entiers, sans flottant.
  String? get collectionRateText {
    final points = collectionRateBasisPoints;
    if (points == null) return null;
    return '${points ~/ 100},${(points % 100) ~/ 10} %';
  }
}

class const TopMandant({
  required final String partyId,
  required final Money payable,
  final String? name,
}) {
  factory TopMandant.fromJson(Map<String, Object?> json) => TopMandant(
    partyId: Json.string(json, 'party_id'),
    name: Json.stringOrNull(json, 'name'),
    payable: Money.fromJson(json, 'payable'),
  );
}

class const AgencyPayouts({
  required final Money payableTotal,
  required final Money inTransitTotal,
  required final int mandantsWithPayable,
  required final List<TopMandant> topMandants,
  required final int activeHolds,
  required final int pendingItems,
}) {
  factory AgencyPayouts.fromJson(Map<String, Object?> json) => AgencyPayouts(
    payableTotal: Money.fromJson(json, 'payable_total'),
    inTransitTotal: Money.fromJson(json, 'in_transit_total'),
    mandantsWithPayable: Json.integer(json, 'mandants_with_payable'),
    topMandants: [
      for (final entry in Json.list(json['top_mandants'], 'top_mandants'))
        TopMandant.fromJson(Json.object(entry, 'mandant')),
    ],
    activeHolds: Json.integer(json, 'active_holds'),
    pendingItems: Json.integer(json, 'pending_items'),
  );
}

class const MandateToRenew({
  required final String id,
  required final String reference,
  required final DateTime endsOn,
}) {
  factory MandateToRenew.fromJson(Map<String, Object?> json) => MandateToRenew(
    id: Json.string(json, 'id'),
    reference: Json.string(json, 'reference'),
    endsOn: Json.day(json, 'ends_on'),
  );
}

class const AgencyAlerts({
  required final int mandatesToRenewCount,
  required final List<MandateToRenew> mandatesToRenew,
  required final int certificatesToRenew,
  required final DateTime reportsPeriodStart,
  required final DateTime reportsPeriodEnd,
  required final int reportsDue,
}) {
  factory AgencyAlerts.fromJson(Map<String, Object?> json) {
    final mandates = Json.child(json, 'mandates_to_renew');
    final reports = Json.child(json, 'reports_due');
    final period = Json.child(reports, 'period');
    return AgencyAlerts(
      mandatesToRenewCount: Json.integer(mandates, 'count'),
      mandatesToRenew: [
        for (final entry in Json.list(mandates['next'], 'next'))
          MandateToRenew.fromJson(Json.object(entry, 'mandat')),
      ],
      certificatesToRenew: Json.integer(json, 'certificates_to_renew'),
      reportsPeriodStart: Json.day(period, 'start'),
      reportsPeriodEnd: Json.day(period, 'end'),
      reportsDue: Json.integer(reports, 'count'),
    );
  }
}
