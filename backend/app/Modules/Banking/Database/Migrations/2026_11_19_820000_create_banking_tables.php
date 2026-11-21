<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('banking_idempotency_keys', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('organization_id')->constrained('organizations');
            $table->string('idempotency_key', 120);
            $table->char('fingerprint', 64);
            $table->string('subject_type', 32);
            $table->uuid('subject_id');
            $table->datetimes(6);

            $table->unique(['organization_id', 'idempotency_key'], 'banking_idempotency_keys_org_key_unique');
        });

        Schema::create('organization_bank_accounts', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('organization_id')->constrained('organizations');
            $table->string('ledger_role', 16);
            $table->string('label', 120);
            $table->string('bank_name', 120)->nullable();
            $table->string('holder_name', 140);
            $table->string('identifier_kind', 8);
            $table->char('identifier_hash', 64);
            $table->string('identifier_last4', 4);
            $table->char('country', 2)->nullable();
            $table->char('currency', 3);
            $table->string('status', 8);
            $table->date('reconciliation_from');
            $table->bigInteger('opening_bank_balance')->default(0);
            $table->uuid('replaces_id')->nullable();
            $table->json('csv_profile')->nullable();
            $table->dateTime('closed_at', 6)->nullable();
            $table->uuid('closed_by_user_id')->nullable();
            $table->uuid('created_by_user_id')->nullable();
            $table->string('active_role', 16)->nullable()->virtualAs("CASE WHEN status = 'active' THEN ledger_role END");
            $table->datetimes(6);

            $table->unique(['organization_id', 'id'], 'bank_accounts_org_id_unique');
            $table->unique(['organization_id', 'active_role'], 'bank_accounts_active_role_unique');
            $table->index(['organization_id', 'identifier_hash'], 'bank_accounts_identifier_index');
            $table->foreign(['organization_id', 'replaces_id'], 'bank_accounts_replaces_foreign')->references(['organization_id', 'id'])->on('organization_bank_accounts');
        });

        Schema::create('bank_statements', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('organization_id')->constrained('organizations');
            $table->uuid('bank_account_id');
            $table->string('source', 12);
            $table->string('format_version', 32)->nullable();
            $table->uuid('stored_file_id')->nullable();
            $table->char('file_sha256', 64);
            $table->string('statement_ref', 64)->nullable();
            $table->string('sequence', 32)->nullable();
            $table->date('period_from');
            $table->date('period_to');
            $table->bigInteger('opening_balance')->nullable();
            $table->bigInteger('closing_balance')->nullable();
            $table->char('currency', 3);
            $table->unsignedInteger('lines_total');
            $table->unsignedInteger('lines_imported');
            $table->unsignedInteger('lines_duplicated');
            $table->unsignedInteger('lines_rejected')->default(0);
            $table->boolean('is_copy')->default(false);
            $table->string('idempotency_key', 120);
            $table->char('fingerprint', 64);
            $table->uuid('imported_by_user_id')->nullable();
            $table->dateTime('voided_at', 6)->nullable();
            $table->uuid('voided_by_user_id')->nullable();
            $table->string('void_reason', 255)->nullable();
            $table->datetimes(6);

            $table->unique(['organization_id', 'id'], 'bank_statements_org_id_unique');
            $table->unique(['organization_id', 'bank_account_id', 'file_sha256'], 'bank_statements_file_unique');
            $table->index(['organization_id', 'bank_account_id', 'period_to'], 'bank_statements_account_period_index');
            $table->foreign(['organization_id', 'bank_account_id'], 'bank_statements_account_foreign')->references(['organization_id', 'id'])->on('organization_bank_accounts');
        });

        Schema::create('bank_statement_lines', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('organization_id')->constrained('organizations');
            $table->uuid('statement_id');
            $table->uuid('bank_account_id');
            $table->unsignedInteger('line_number');
            $table->date('booking_date');
            $table->date('value_date')->nullable();
            $table->string('direction', 6);
            $table->unsignedBigInteger('amount');
            $table->char('currency', 3);
            $table->unsignedBigInteger('original_amount')->nullable();
            $table->char('original_currency', 3)->nullable();
            $table->boolean('reversal')->default(false);
            $table->string('bank_reference', 64)->nullable();
            $table->string('end_to_end_id', 64)->nullable();
            $table->string('transaction_code', 40)->nullable();
            $table->string('label', 500);
            $table->string('remittance_reference', 140)->nullable();
            $table->string('counterparty_name', 140)->nullable();
            $table->char('counterparty_hash', 64)->nullable();
            $table->string('counterparty_last4', 4)->nullable();
            $table->char('dedup_key', 64);
            $table->unsignedInteger('occurrence');
            $table->string('state', 10);
            $table->string('ignore_reason', 20)->nullable();
            $table->uuid('ignore_group_id')->nullable();
            $table->unsignedInteger('lock_version')->default(1);
            $table->datetimes(6);

            $table->unique(['organization_id', 'id'], 'bank_lines_org_id_unique');
            $table->index(['organization_id', 'bank_account_id', 'ignore_group_id'], 'bank_lines_ignore_group_index');
            $table->unique(['organization_id', 'bank_account_id', 'dedup_key', 'occurrence'], 'bank_lines_dedup_unique');
            $table->index(['organization_id', 'bank_account_id', 'state', 'booking_date'], 'bank_lines_account_state_index');
            $table->index(['organization_id', 'statement_id'], 'bank_lines_statement_index');
            $table->index(['organization_id', 'counterparty_hash'], 'bank_lines_counterparty_index');
            $table->foreign(['organization_id', 'statement_id'], 'bank_lines_statement_foreign')->references(['organization_id', 'id'])->on('bank_statements');
            $table->foreign(['organization_id', 'bank_account_id'], 'bank_lines_account_foreign')->references(['organization_id', 'id'])->on('organization_bank_accounts');
        });

        Schema::create('bank_matches', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('organization_id')->constrained('organizations');
            $table->uuid('bank_account_id');
            $table->string('kind', 10);
            $table->string('rule', 24)->nullable();
            $table->string('confidence', 8)->nullable();
            $table->json('explanation')->nullable();
            $table->uuid('matched_by_user_id')->nullable();
            $table->dateTime('undone_at', 6)->nullable();
            $table->uuid('undone_by_user_id')->nullable();
            $table->string('undo_reason', 255)->nullable();
            $table->datetimes(6);

            $table->unique(['organization_id', 'id'], 'bank_matches_org_id_unique');
            $table->index(['organization_id', 'bank_account_id', 'undone_at'], 'bank_matches_account_index');
            $table->foreign(['organization_id', 'bank_account_id'], 'bank_matches_account_foreign')->references(['organization_id', 'id'])->on('organization_bank_accounts');
        });

        Schema::create('bank_match_items', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('organization_id')->constrained('organizations');
            $table->uuid('match_id');
            $table->string('side', 14);
            $table->uuid('ref_id');
            $table->unsignedBigInteger('amount');
            $table->char('currency', 3);
            $table->dateTime('undone_at', 6)->nullable();
            $table->char('active_key', 36)->nullable()->virtualAs('CASE WHEN undone_at IS NULL THEN ref_id END');
            $table->datetimes(6);

            $table->unique(['organization_id', 'side', 'active_key'], 'bank_match_items_active_unique');
            $table->index(['organization_id', 'match_id'], 'bank_match_items_match_index');
            $table->index(['organization_id', 'side', 'ref_id'], 'bank_match_items_ref_index');
            $table->foreign(['organization_id', 'match_id'], 'bank_match_items_match_foreign')->references(['organization_id', 'id'])->on('bank_matches');
        });

        Schema::create('bank_suggestions', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('organization_id')->constrained('organizations');
            $table->uuid('statement_line_id');
            $table->string('rule', 24);
            $table->string('confidence', 8);
            $table->unsignedSmallInteger('score');
            $table->string('action', 16);
            $table->json('targets');
            $table->json('explanation');
            $table->string('ledger_version', 80);
            $table->dateTime('computed_at', 6);
            $table->datetimes(6);

            $table->index(['organization_id', 'statement_line_id'], 'bank_suggestions_line_index');
            $table->foreign(['organization_id', 'statement_line_id'], 'bank_suggestions_line_foreign')->references(['organization_id', 'id'])->on('bank_statement_lines');
        });

        Schema::create('bank_rules', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('organization_id')->constrained('organizations');
            $table->string('name', 120);
            $table->string('label_contains', 120)->nullable();
            $table->char('counterparty_hash', 64)->nullable();
            $table->string('transaction_code', 40)->nullable();
            $table->unsignedBigInteger('amount_min')->nullable();
            $table->unsignedBigInteger('amount_max')->nullable();
            $table->string('direction', 6)->nullable();
            $table->string('action', 24);
            $table->uuid('target_lease_id')->nullable();
            $table->uuid('target_party_id')->nullable();
            $table->string('ignore_reason', 20)->nullable();
            $table->string('confidence', 8)->default('weak');
            $table->unsignedInteger('position');
            $table->boolean('active')->default(true);
            $table->unsignedInteger('lock_version')->default(1);
            $table->uuid('created_by_user_id')->nullable();
            $table->datetimes(6);

            $table->unique(['organization_id', 'id'], 'bank_rules_org_id_unique');
            $table->index(['organization_id', 'active', 'position'], 'bank_rules_position_index');
        });

        Schema::create('bank_counterparty_links', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('organization_id')->constrained('organizations');
            $table->char('counterparty_hash', 64);
            $table->uuid('party_id');
            $table->string('origin', 10);
            $table->unsignedInteger('confirmations')->default(0);
            $table->dateTime('last_confirmed_at', 6)->nullable();
            $table->datetimes(6);

            $table->unique(['organization_id', 'counterparty_hash', 'party_id'], 'bank_counterparty_links_unique');
        });

        Schema::create('bank_reconciliations', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('organization_id')->constrained('organizations');
            $table->uuid('bank_account_id');
            $table->date('as_of');
            $table->char('currency', 3);
            $table->string('bank_balance_source', 10);
            $table->bigInteger('bank_balance');
            $table->uuid('balance_proof_file_id')->nullable();
            $table->bigInteger('book_balance');
            $table->bigInteger('unmatched_lines_total');
            $table->bigInteger('unmatched_entries_total');
            $table->bigInteger('ignored_total');
            $table->bigInteger('timing_difference');
            $table->bigInteger('unexplained_difference');
            $table->json('items');
            $table->string('ledger_version', 64);
            $table->string('status', 10);
            $table->uuid('validated_by_user_id')->nullable();
            $table->dateTime('validated_at', 6)->nullable();
            $table->uuid('supersedes_id')->nullable();
            $table->uuid('created_by_user_id')->nullable();
            $table->datetimes(6);

            $table->unique(['organization_id', 'id'], 'bank_reconciliations_org_id_unique');
            $table->index(['organization_id', 'bank_account_id', 'as_of', 'status'], 'bank_reconciliations_account_index');
            $table->foreign(['organization_id', 'bank_account_id'], 'bank_reconciliations_account_foreign')->references(['organization_id', 'id'])->on('organization_bank_accounts');
            $table->foreign(['organization_id', 'supersedes_id'], 'bank_reconciliations_supersedes_foreign')->references(['organization_id', 'id'])->on('bank_reconciliations');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('bank_reconciliations');
        Schema::dropIfExists('bank_counterparty_links');
        Schema::dropIfExists('bank_rules');
        Schema::dropIfExists('bank_suggestions');
        Schema::dropIfExists('bank_match_items');
        Schema::dropIfExists('bank_matches');
        Schema::dropIfExists('bank_statement_lines');
        Schema::dropIfExists('bank_statements');
        Schema::dropIfExists('organization_bank_accounts');
        Schema::dropIfExists('banking_idempotency_keys');
    }
};
