<?php

declare(strict_types=1);

use App\Modules\Banking\Enums\AccountStatus;
use App\Modules\Banking\Enums\Confidence;
use App\Modules\Banking\Enums\Direction;
use App\Modules\Banking\Enums\IdentifierKind;
use App\Modules\Banking\Enums\IgnoreReason;
use App\Modules\Banking\Enums\LedgerRole;
use App\Modules\Banking\Enums\LineState;
use App\Modules\Banking\Enums\MatchKind;
use App\Modules\Banking\Enums\MatchSide;
use App\Modules\Banking\Enums\ReconciliationStatus;
use App\Modules\Banking\Enums\RuleAction;
use App\Modules\Banking\Enums\StatementSource;
use App\Modules\Banking\Enums\SuggestionAction;
use App\Modules\Banking\Enums\SuggestionRule;
use App\Shared\Database\Checks;
use App\Shared\Database\RowGuards;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    public function up(): void
    {
        $this->controles();
        $this->declencheurs();
    }

    public function down(): void
    {
        // Contraintes et déclencheurs tombent avec leurs tables (migration 820000).
    }

    private function controles(): void
    {
        Checks::add('organization_bank_accounts', 'ledger_role', Checks::enum('ledger_role', LedgerRole::class));
        Checks::add('organization_bank_accounts', 'kind', Checks::enum('identifier_kind', IdentifierKind::class));
        Checks::add('organization_bank_accounts', 'status', Checks::enum('status', AccountStatus::class));
        Checks::add('organization_bank_accounts', 'currency', Checks::uppercase('currency', 3));
        Checks::add('bank_statements', 'source', Checks::enum('source', StatementSource::class));
        Checks::add('bank_statements', 'currency', Checks::uppercase('currency', 3));
        Checks::add('bank_statements', 'counts', 'lines_imported + lines_duplicated <= lines_total');
        Checks::add('bank_statements', 'period', 'period_to >= period_from');
        Checks::add('bank_statement_lines', 'direction', Checks::enum('direction', Direction::class));
        Checks::add('bank_statement_lines', 'state', Checks::enum('state', LineState::class));
        Checks::add('bank_statement_lines', 'ignore_reason', Checks::enum('ignore_reason', IgnoreReason::class, nullable: true));
        Checks::add('bank_statement_lines', 'ignored', "(state = 'ignored') = (ignore_reason IS NOT NULL)");
        Checks::add('bank_statement_lines', 'amount', 'amount > 0 AND occurrence >= 1');
        Checks::add('bank_statement_lines', 'currency', Checks::uppercase('currency', 3));
        Checks::add('bank_matches', 'kind', Checks::enum('kind', MatchKind::class));
        Checks::add('bank_matches', 'confidence', Checks::enum('confidence', Confidence::class, nullable: true));
        Checks::add('bank_matches', 'rule', Checks::enum('rule', SuggestionRule::class, nullable: true));
        Checks::add('bank_match_items', 'side', Checks::enum('side', MatchSide::class));
        Checks::add('bank_match_items', 'amount', 'amount > 0');
        Checks::add('bank_suggestions', 'rule', Checks::enum('rule', SuggestionRule::class));
        Checks::add('bank_suggestions', 'confidence', Checks::enum('confidence', Confidence::class));
        Checks::add('bank_suggestions', 'action', Checks::enum('action', SuggestionAction::class));
        Checks::add('bank_rules', 'action', Checks::enum('action', RuleAction::class));
        Checks::add('bank_rules', 'direction', Checks::enum('direction', Direction::class, nullable: true));
        Checks::add('bank_rules', 'confidence', Checks::enum('confidence', Confidence::class));
        Checks::add('bank_rules', 'amounts', 'amount_min IS NULL OR amount_max IS NULL OR amount_min <= amount_max');
        Checks::add('bank_counterparty_links', 'origin', "origin IN ('parties', 'confirmed')");
        Checks::add('bank_reconciliations', 'status', Checks::enum('status', ReconciliationStatus::class));
        Checks::add('bank_reconciliations', 'validated', "status = 'draft' OR unexplained_difference = 0");
    }

    private function declencheurs(): void
    {
        $comptes = ['id', 'organization_id', 'ledger_role', 'label', 'bank_name', 'holder_name', 'identifier_kind', 'identifier_hash', 'identifier_last4', 'country', 'currency', 'status',
            'reconciliation_from', 'opening_bank_balance', 'replaces_id', 'csv_profile', 'closed_at', 'closed_by_user_id', 'created_by_user_id', 'created_at', 'updated_at'];
        $releves = ['id', 'organization_id', 'bank_account_id', 'source', 'format_version', 'stored_file_id', 'file_sha256', 'statement_ref', 'sequence', 'period_from', 'period_to',
            'opening_balance', 'closing_balance', 'currency', 'lines_total', 'lines_imported', 'lines_duplicated', 'lines_rejected', 'is_copy', 'idempotency_key', 'fingerprint',
            'imported_by_user_id', 'voided_at', 'voided_by_user_id', 'void_reason', 'created_at', 'updated_at'];
        $lignes = ['id', 'organization_id', 'statement_id', 'bank_account_id', 'line_number', 'booking_date', 'value_date', 'direction', 'amount', 'currency', 'original_amount',
            'original_currency', 'reversal', 'bank_reference', 'end_to_end_id', 'transaction_code', 'label', 'remittance_reference', 'counterparty_name', 'counterparty_hash',
            'counterparty_last4', 'dedup_key', 'occurrence', 'state', 'ignore_reason', 'ignore_group_id', 'lock_version', 'created_at', 'updated_at'];
        $pointages = ['id', 'organization_id', 'bank_account_id', 'kind', 'rule', 'confidence', 'explanation', 'matched_by_user_id', 'undone_at', 'undone_by_user_id', 'undo_reason', 'created_at', 'updated_at'];
        $elements = ['id', 'organization_id', 'match_id', 'side', 'ref_id', 'amount', 'currency', 'undone_at', 'created_at', 'updated_at'];
        $etats = ['id', 'organization_id', 'bank_account_id', 'as_of', 'currency', 'bank_balance_source', 'bank_balance', 'balance_proof_file_id', 'book_balance', 'unmatched_lines_total', 'unmatched_entries_total',
            'ignored_total', 'timing_difference', 'unexplained_difference', 'items', 'ledger_version', 'status', 'validated_by_user_id', 'validated_at', 'supersedes_id', 'created_by_user_id',
            'created_at', 'updated_at'];

        RowGuards::install([
            ...RowGuards::frozenExcept('organization_bank_accounts', $comptes, ['label', 'csv_profile', 'status', 'closed_at', 'closed_by_user_id', 'updated_at']),
            ['bank_accounts_fermeture_unique', 'BEFORE UPDATE', 'organization_bank_accounts', "OLD.status = 'closed' AND (".RowGuards::changed(['status']).')', 'organization_bank_accounts : compte ferme'],
            ...RowGuards::frozenExcept('bank_statements', $releves, ['voided_at', 'voided_by_user_id', 'void_reason', 'updated_at']),
            ['bank_statements_annulation_unique', 'BEFORE UPDATE', 'bank_statements', 'OLD.voided_at IS NOT NULL AND ('.RowGuards::changed(['voided_at']).')', 'bank_statements : import deja annule'],
            ...RowGuards::frozenExcept('bank_statement_lines', $lignes, ['state', 'ignore_reason', 'ignore_group_id', 'lock_version', 'updated_at']),
            ...RowGuards::frozenExcept('bank_matches', $pointages, ['undone_at', 'undone_by_user_id', 'undo_reason', 'updated_at']),
            ['bank_matches_defait_unique', 'BEFORE UPDATE', 'bank_matches', 'OLD.undone_at IS NOT NULL AND ('.RowGuards::changed(['undone_at']).')', 'bank_matches : pointage deja defait'],
            ...RowGuards::frozenExcept('bank_match_items', $elements, ['undone_at', 'updated_at']),
            ['bank_match_items_defait_unique', 'BEFORE UPDATE', 'bank_match_items', 'OLD.undone_at IS NOT NULL AND ('.RowGuards::changed(['undone_at']).')', 'bank_match_items : element deja defait'],
            ['bank_reconciliations_figee', 'BEFORE UPDATE', 'bank_reconciliations', "OLD.status IN ('validated', 'superseded') AND (".RowGuards::changed(array_values(array_diff($etats, ['status', 'updated_at']))).')', 'bank_reconciliations : etat valide fige'],
            ['bank_reconciliations_statut_final', 'BEFORE UPDATE', 'bank_reconciliations', "(OLD.status = 'superseded' AND ".RowGuards::changed(['status']).") OR (OLD.status = 'validated' AND NEW.status NOT IN ('validated', 'superseded'))", 'bank_reconciliations : statut final'],
            ['bank_reconciliations_sans_suppression', 'BEFORE DELETE', 'bank_reconciliations', "OLD.status <> 'draft'", 'bank_reconciliations : etat valide ne se supprime pas'],
        ]);
    }
};
