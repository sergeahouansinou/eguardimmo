<?php

declare(strict_types=1);

use App\Modules\Charges\Enums\ExerciseStatus;
use App\Modules\Charges\Enums\ExpenseKind;
use App\Modules\Charges\Enums\ExpenseSettlement;
use App\Modules\Charges\Enums\ExpenseStatus;
use App\Modules\Charges\Enums\KeyKind;
use App\Modules\Charges\Enums\SourceKind;
use App\Modules\Charges\Enums\StatementSettlement;
use App\Modules\Charges\Enums\StatementStatus;
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
        // Contraintes et déclencheurs tombent avec leurs tables (migration 520000).
    }

    private function controles(): void
    {
        Checks::add('expenses', 'kind', Checks::enum('kind', ExpenseKind::class));
        Checks::add('expenses', 'status', Checks::enum('status', ExpenseStatus::class));
        Checks::add('expenses', 'settlement', Checks::enum('settlement', ExpenseSettlement::class));
        Checks::add('expenses', 'currency', Checks::uppercase('currency', 3));
        Checks::add('expenses', 'amounts', 'total_gross > 0 AND recoverable_amount <= total_gross AND tax_amount <= total_gross');
        Checks::add('expenses', 'service', 'service_to > service_from');
        Checks::add('expenses', 'payee', 'payee_party_id IS NOT NULL OR payee_label IS NOT NULL');
        Checks::add('charge_keys', 'kind', Checks::enum('kind', KeyKind::class));
        Checks::add('charge_exercises', 'status', Checks::enum('status', ExerciseStatus::class));
        Checks::add('charge_exercises', 'period', 'period_end > period_start');
        Checks::add('charge_items', 'target', 'key_id IS NOT NULL OR unit_id IS NOT NULL');
        Checks::add('charge_item_sources', 'kind', Checks::enum('source_kind', SourceKind::class));
        Checks::add('charge_statements', 'status', Checks::enum('status', StatementStatus::class));
        Checks::add('charge_statements', 'settlement', Checks::enum('settlement', StatementSettlement::class, nullable: true));
        Checks::add('charge_statements', 'currency', Checks::uppercase('currency', 3));
        Checks::add('charge_statement_files', 'visible_until', 'tenant_visible = 0 OR visible_until IS NOT NULL');
    }

    private function declencheurs(): void
    {
        $depenses = ['id', 'organization_id', 'property_id', 'unit_id', 'kind', 'category_term_id', 'payee_party_id', 'payee_label', 'reference', 'document_on', 'service_from', 'service_to',
            'currency', 'total_gross', 'tax_amount', 'recoverable_amount', 'recoverable_rubric', 'settlement', 'paid_on', 'mandate_id', 'mandant_party_id', 'stored_file_id',
            'fingerprint', 'active_fingerprint', 'status', 'cancel_reason', 'approved_by_user_id', 'ledger_entry_id', 'cancellation_entry_id', 'idempotency_key', 'lock_version', 'created_by_user_id', 'created_at', 'updated_at'];
        $decomptes = ['id', 'organization_id', 'exercise_id', 'lease_id', 'number', 'status', 'occupied_days', 'share_total', 'provisions_called', 'provisions_unpaid', 'balance',
            'suggested_monthly_provision', 'currency', 'settlement', 'not_before', 'mandate_id', 'mandant_party_id', 'snapshot', 'fingerprint', 'template_version', 'issued_document_id',
            'stored_file_id', 'issued_at', 'visible_until', 'supersedes_id', 'rectification_reason', 'failure_reason', 'idempotency_key', 'lock_version', 'created_at', 'updated_at'];

        RowGuards::install([
            ...RowGuards::frozenExcept('expenses', $depenses, ['status', 'cancel_reason', 'approved_by_user_id', 'ledger_entry_id', 'cancellation_entry_id', 'active_fingerprint', 'stored_file_id', 'lock_version', 'updated_at']),
            ['charge_key_versions_ajout_seul', 'BEFORE UPDATE', 'charge_key_versions', RowGuards::changed(['key_id', 'valid_from', 'organization_id']), 'charge_key_versions : ajout seul'],
            ['charge_key_versions_sans_suppression', 'BEFORE DELETE', 'charge_key_versions', '1 = 1', 'charge_key_versions ne se supprime pas'],
            ...RowGuards::frozenExcept('charge_key_shares', ['id', 'organization_id', 'version_id', 'unit_id', 'weight', 'created_at', 'updated_at'], []),
            RowGuards::frozenExcept('charge_statement_lines', ['id', 'organization_id', 'statement_id', 'item_id', 'label', 'rubric', 'split_label', 'item_amount', 'weight', 'denominator', 'days', 'share', 'position', 'created_at', 'updated_at'], [])[0],
            ['charge_statement_lines_suppr_figee', 'BEFORE DELETE', 'charge_statement_lines', "(SELECT status FROM charge_statements WHERE id = OLD.statement_id) IN ('issued', 'superseded')", 'charge_statement_lines : decompte emis fige'],
            ['charge_statement_lines_ajout_fige', 'BEFORE INSERT', 'charge_statement_lines', "(SELECT status FROM charge_statements WHERE id = NEW.statement_id) NOT IN ('computed', 'failed')", 'charge_statement_lines : decompte emis fige'],
            ['charge_statements_emis_figes', 'BEFORE UPDATE', 'charge_statements', "OLD.status IN ('issued', 'superseded') AND (".RowGuards::changed(array_values(array_diff($decomptes, ['status', 'lock_version', 'updated_at']))).')', 'charge_statements : decompte emis fige'],
            ['charge_statements_statut_final', 'BEFORE UPDATE', 'charge_statements', "(OLD.status = 'superseded' AND ".RowGuards::changed(['status']).") OR (OLD.status = 'issued' AND NEW.status NOT IN ('issued', 'superseded'))", 'charge_statements : statut final'],
            ['charge_statements_sans_suppression', 'BEFORE DELETE', 'charge_statements', "OLD.status IN ('issued', 'superseded')", 'charge_statements : decompte emis ne se supprime pas'],
            ['charge_statement_files_visible_ajout', 'BEFORE INSERT', 'charge_statement_files', 'NEW.tenant_visible = 1 AND NEW.visible_until IS NULL', 'charge_statement_files : une piece visible a une date limite'],
            ['charge_statement_files_visible_modif', 'BEFORE UPDATE', 'charge_statement_files', 'NEW.tenant_visible = 1 AND NEW.visible_until IS NULL', 'charge_statement_files : une piece visible a une date limite'],
            ...$this->postesFiges('charge_items', 'OLD.exercise_id', 'NEW.exercise_id'),
            ...$this->postesFiges('charge_item_sources', 'OLD.exercise_id', 'NEW.exercise_id'),
        ]);
    }

    /**
     * @return list<array{string, string, string, string, string}>
     */
    private function postesFiges(string $table, string $ancien, string $nouveau): array
    {
        $fige = fn (string $colonne): string => "(SELECT status FROM charge_exercises WHERE id = {$colonne}) NOT IN ('draft', 'computed')";

        return [
            ["{$table}_ajout_fige", 'BEFORE INSERT', $table, $fige($nouveau), "{$table} : exercice fige"],
            ["{$table}_modif_figee", 'BEFORE UPDATE', $table, $fige($ancien), "{$table} : exercice fige"],
            ["{$table}_suppr_figee", 'BEFORE DELETE', $table, $fige($ancien), "{$table} : exercice fige"],
        ];
    }
};
