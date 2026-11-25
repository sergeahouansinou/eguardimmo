import 'package:eguardimmo/features/owner/models/owner_access.dart';
import 'package:eguardimmo/features/owner/models/owner_document.dart';
import 'package:eguardimmo/features/owner/models/owner_home.dart';
import 'package:eguardimmo/features/owner/models/owner_payout.dart';
import 'package:eguardimmo/features/owner/models/owner_statement.dart';
import 'package:eguardimmo/features/owner/models/owner_unit.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../helpers/api_fixtures.dart';

Map<String, Object?> _first(String fixture) =>
    (apiObject(fixture)['data']! as List<Object?>).first!
        as Map<String, Object?>;

void main() {
  test('accès : rôle, agence, lecture seule et période de grâce', () {
    final data = (apiObject('owner/agencies')['data']! as List<Object?>)
        .cast<Map<String, Object?>>();
    final holder = OwnerAccess.fromJson(data[0]);
    final grace = OwnerAccess.fromJson(data[1]);
    expect(holder.agencyName, 'Agence du Lac');
    expect(holder.label, 'Agence du Lac · Famille Dossou');
    expect(holder.accessUntil, isNull);
    expect(holder.readOnly, isFalse);
    expect(grace.inGrace, isTrue);
    expect(grace.readOnly, isTrue);
    expect(grace.accessUntil, DateTime(2026, 12, 31));
    expect(ownerRoleLabel(grace.role), 'Représentant du titulaire');
  });

  test('accueil : montants en unités mineures, XOF sans décimales', () {
    final home = OwnerHome.fromJson(
      (apiObject('owner/home')['data']! as Map<String, Object?>),
    );
    expect(home.called.minor, 1200000);
    expect(home.collected.currency, 'XOF');
    expect(home.arrears.minor, 500000);
    expect(home.arrearsCount, 1);
    expect(home.arrearsMaxDays, 11);
    expect(home.quotesToDecide, 2);
    expect(home.payouts?.pending?.net.minor, 641200);
    expect(home.payouts?.last?.number, 'RV-2026-0006');
    expect(home.payouts?.nextDate, DateTime(2026, 12, 5));
    expect(home.lastReport?.isRead, isFalse);
    expect(home.units.map((u) => u.state), [
      UnitState.occupied,
      UnitState.late,
      UnitState.vacant,
    ]);
    expect(home.units.last.tenantName, isNull);
    expect(home.units.last.rent, isNull);
    expect(home.called.text.replaceAll(RegExp(r'\s'), ' '), contains('1'));
    expect(home.called.text, isNot(contains(',')));
  });

  test('accueil sans reversement ni compte rendu : champs absents', () {
    final json = apiObject('owner/home');
    final data = json['data']! as Map<String, Object?>;
    data['payouts'] = null;
    data['last_report'] = null;
    final home = OwnerHome.fromJson(data);
    expect(home.payouts, isNull);
    expect(home.lastReport, isNull);
  });

  test('accueil : état de lot inconnu refusé', () {
    final data = apiObject('owner/home')['data']! as Map<String, Object?>;
    ((data['units']! as List<Object?>).first!
            as Map<String, Object?>)['state'] =
        'demolished';
    expect(() => OwnerHome.fromJson(data), throwsFormatException);
  });

  test('reversement : statuts et libellés', () {
    final page = (apiObject('owner/payouts')['data']! as List<Object?>)
        .map((e) => OwnerPayout.fromJson(e! as Map<String, Object?>))
        .toList();
    expect(page.map((p) => p.status.label), [
      'Programmé',
      'Versé',
      'Retourné par la banque',
    ]);
    expect(page[2].bankLast4, isNull);
    expect(page[0].amount.minor, 641200);
  });

  test('reversement : statut inconnu refusé', () {
    final json = Map<String, Object?>.of(_first('owner/payouts'))
      ..['status'] = 'cancelled';
    expect(() => OwnerPayout.fromJson(json), throwsFormatException);
  });

  test('reversement prévu : message du serveur conservé', () {
    final upcoming = (apiObject('owner/payouts')['upcoming']! as List<Object?>)
        .map((e) => UpcomingPayout.fromJson(e! as Map<String, Object?>))
        .single;
    expect(upcoming.agencyName, 'Agence du Lac');
    expect(upcoming.notice, contains('jour de reversement'));
  });

  test('relevé : lignes débit et crédit, source libellée', () {
    final statement = OwnerStatement.fromJson(
      apiObject('owner/statement')['data']! as Map<String, Object?>,
    );
    expect(statement.closing.minor, 641200);
    expect(statement.lines, hasLength(2));
    expect(statement.lines.first.credit.minor, 700000);
    expect(statement.lines.first.sourceLabel, 'Encaissement');
    expect(statement.lines.last.sourceLabel, 'Honoraires prélevés');
  });

  test('bien : type, adresse et période de couverture', () {
    final unit = OwnerUnit.fromJson(_first('owner/properties'));
    expect(unit.typeLabel, 'Appartement');
    expect(unit.address.oneLine, '14 avenue de la Marina, 98000 Monaco');
    expect(unit.coveredUntil, isNull);
  });

  test('document : libellé, déposant et mandat', () {
    final document = OwnerDocument.fromJson(_first('owner/documents'));
    expect(document.kindLabel, 'Mandat signé');
    expect(document.byAgency, isTrue);
    expect(document.mandateReference, 'M-2026-0001');
    expect(document.sizeBytes, 1048576);
  });

  test('document sans mandat', () {
    final json = Map<String, Object?>.of(_first('owner/documents'))
      ..['mandate'] = null;
    expect(OwnerDocument.fromJson(json).mandateReference, isNull);
  });
}
