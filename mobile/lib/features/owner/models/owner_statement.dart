import '../../../core/models/money.dart';
import '../../../core/utils/json_reader.dart';

const _sourceLabels = {
  'installment': 'Échéance de loyer',
  'payment': 'Encaissement',
  'invoice': 'Facture',
  'credit_note': 'Avoir',
  'deposit': 'Dépôt de garantie',
  'recovery_fee': 'Frais de recouvrement',
  'adjustment': 'Ajustement',
  'journal_entry': 'Écriture comptable',
  'supplier_invoice': 'Facture de prestataire',
  'supplier_allocation': 'Imputation prestataire',
  'supplier_payment': 'Règlement de prestataire',
  'owner_payout': 'Reversement',
  'fee_settlement': 'Honoraires prélevés',
  'trust_transfer': 'Virement entre comptes',
  'expense': 'Dépense',
  'charge_statement': 'Décompte de charges',
  'bank_line': 'Mouvement bancaire',
};

class const StatementLine({
  required final DateTime date,
  required final String reference,
  required final String label,
  required final String source,
  required final bool isReversal,
  required final Money debit,
  required final Money credit,
  required final Money balance,
}) {
  factory StatementLine.fromJson(Map<String, Object?> json) => StatementLine(
    date: Json.day(json, 'date'),
    reference: Json.string(json, 'reference'),
    label: Json.string(json, 'label'),
    source: Json.string(json, 'source'),
    isReversal: Json.boolean(json, 'is_reversal'),
    debit: Money.fromJson(json, 'debit'),
    credit: Money.fromJson(json, 'credit'),
    balance: Money.fromJson(json, 'balance'),
  );

  String get sourceLabel => _sourceLabels[source] ?? 'Autre opération';
}

class const OwnerStatement({
  required final String mandantName,
  required final Money opening,
  required final Money closing,
  required final List<StatementLine> lines,
}) {
  factory OwnerStatement.fromJson(Map<String, Object?> json) => OwnerStatement(
    mandantName: Json.string(Json.child(json, 'mandant'), 'name'),
    opening: Money.fromJson(json, 'opening_balance'),
    closing: Money.fromJson(json, 'closing_balance'),
    lines: [
      for (final line in Json.list(json['lines'], 'lines'))
        StatementLine.fromJson(Json.object(line, 'ligne')),
    ],
  );
}
