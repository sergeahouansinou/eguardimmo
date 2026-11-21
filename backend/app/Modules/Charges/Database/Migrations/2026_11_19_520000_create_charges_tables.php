<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $this->expenses();
        $this->keys();
        $this->exercises();
        $this->statements();
    }

    public function down(): void
    {
        foreach (['charge_idempotency', 'charge_due_flags', 'charge_statement_plans', 'charge_statement_files', 'charge_statement_lines', 'charge_statements', 'charge_sequences',
            'charge_source_locks', 'charge_item_sources', 'charge_consumptions', 'charge_items', 'charge_exercises', 'charge_property_locks',
            'charge_key_shares', 'charge_key_versions', 'charge_keys', 'expense_files', 'expenses'] as $table) {
            Schema::dropIfExists($table);
        }
    }

    private function expenses(): void
    {
        Schema::create('expenses', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('organization_id')->constrained('organizations');
            $table->uuid('property_id');
            $table->uuid('unit_id')->nullable();
            $table->string('kind', 24);
            $table->uuid('category_term_id');
            $table->uuid('payee_party_id')->nullable();
            $table->string('payee_label', 120)->nullable();
            $table->string('reference', 64)->nullable();
            $table->date('document_on');
            $table->date('service_from');
            $table->date('service_to');
            $table->char('currency', 3);
            $table->unsignedBigInteger('total_gross');
            $table->unsignedBigInteger('tax_amount')->default(0);
            $table->unsignedBigInteger('recoverable_amount')->default(0);
            $table->string('recoverable_rubric', 64)->nullable();
            $table->string('settlement', 20);
            $table->date('paid_on')->nullable();
            $table->uuid('mandate_id')->nullable();
            $table->uuid('mandant_party_id')->nullable();
            $table->uuid('stored_file_id')->nullable();
            $table->char('fingerprint', 64);
            $table->char('active_fingerprint', 64)->nullable();
            $table->string('status', 20);
            $table->string('cancel_reason', 255)->nullable();
            $table->uuid('approved_by_user_id')->nullable();
            $table->uuid('ledger_entry_id')->nullable();
            $table->uuid('cancellation_entry_id')->nullable();
            $table->string('idempotency_key', 120);
            $table->unsignedInteger('lock_version')->default(1);
            $table->uuid('created_by_user_id')->nullable();
            $table->datetimes(6);

            $table->unique(['organization_id', 'id']);
            $table->unique(['organization_id', 'idempotency_key'], 'expenses_org_key_unique');
            $table->unique(['organization_id', 'active_fingerprint'], 'expenses_org_active_fingerprint_unique');
            $table->index(['organization_id', 'property_id', 'document_on'], 'expenses_property_date_idx');
            $table->index(['organization_id', 'unit_id'], 'expenses_unit_idx');
        });

        Schema::create('expense_files', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('organization_id')->constrained('organizations');
            $table->uuid('expense_id');
            $table->uuid('stored_file_id');
            $table->uuid('created_by_user_id')->nullable();
            $table->datetimes(6);

            $table->unique(['organization_id', 'id']);
            $table->index(['expense_id'], 'expense_files_expense_idx');
            $table->foreign('expense_id', 'expense_files_expense_foreign')->references('id')->on('expenses');
        });
    }

    private function keys(): void
    {
        Schema::create('charge_keys', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('organization_id')->constrained('organizations');
            $table->uuid('property_id');
            $table->string('label', 120);
            $table->string('kind', 12);
            $table->dateTime('archived_at', 6)->nullable();
            $table->unsignedInteger('lock_version')->default(1);
            $table->uuid('created_by_user_id')->nullable();
            $table->datetimes(6);

            $table->unique(['organization_id', 'id']);
            $table->index(['organization_id', 'property_id'], 'charge_keys_property_idx');
        });

        Schema::create('charge_key_versions', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('organization_id')->constrained('organizations');
            $table->uuid('key_id');
            $table->date('valid_from');
            $table->date('valid_to')->nullable();
            $table->datetimes(6);

            $table->unique(['organization_id', 'id']);
            $table->index(['key_id', 'valid_from'], 'charge_key_versions_key_from_idx');
            $table->foreign('key_id', 'charge_key_versions_key_foreign')->references('id')->on('charge_keys');
        });

        Schema::create('charge_key_shares', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('organization_id')->constrained('organizations');
            $table->uuid('version_id');
            $table->uuid('unit_id');
            $table->unsignedBigInteger('weight');
            $table->datetimes(6);

            $table->unique(['version_id', 'unit_id'], 'charge_key_shares_version_unit_unique');
            $table->foreign('version_id', 'charge_key_shares_version_foreign')->references('id')->on('charge_key_versions');
        });
    }

    private function exercises(): void
    {
        Schema::create('charge_property_locks', function (Blueprint $table): void {
            $table->uuid('property_id');
            $table->foreignUuid('organization_id')->constrained('organizations');
            $table->primary(['property_id']);
        });

        Schema::create('charge_exercises', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('organization_id')->constrained('organizations');
            $table->uuid('property_id');
            $table->date('period_start');
            $table->date('period_end');
            $table->string('status', 12);
            $table->string('jurisdiction', 8);
            $table->uuid('only_lease_id')->nullable();
            $table->uuid('supersedes_statement_id')->nullable();
            $table->string('rectification_reason', 255)->nullable();
            $table->boolean('prescription_acknowledged')->default(false);
            $table->dateTime('computed_at', 6)->nullable();
            $table->dateTime('issued_at', 6)->nullable();
            $table->string('idempotency_key', 120)->nullable();
            $table->char('fingerprint', 64)->nullable();
            $table->unsignedInteger('lock_version')->default(1);
            $table->uuid('created_by_user_id')->nullable();
            $table->datetimes(6);

            $table->unique(['organization_id', 'id']);
            $table->unique(['organization_id', 'idempotency_key'], 'charge_exercises_org_key_unique');
            $table->index(['organization_id', 'property_id', 'status'], 'charge_exercises_property_status_idx');
        });

        Schema::create('charge_items', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('organization_id')->constrained('organizations');
            $table->uuid('exercise_id');
            $table->string('label', 120);
            $table->string('rubric', 64);
            $table->uuid('key_id')->nullable();
            $table->uuid('unit_id')->nullable();
            $table->unsignedBigInteger('amount');
            $table->char('currency', 3);
            $table->unsignedSmallInteger('position');
            $table->datetimes(6);

            $table->unique(['organization_id', 'id']);
            $table->index(['exercise_id', 'position'], 'charge_items_exercise_idx');
            $table->foreign('exercise_id', 'charge_items_exercise_foreign')->references('id')->on('charge_exercises');
        });

        Schema::create('charge_consumptions', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('organization_id')->constrained('organizations');
            $table->uuid('item_id');
            $table->uuid('unit_id');
            $table->unsignedBigInteger('quantity_milli');
            $table->datetimes(6);

            $table->unique(['item_id', 'unit_id'], 'charge_consumptions_item_unit_unique');
            $table->foreign('item_id', 'charge_consumptions_item_foreign')->references('id')->on('charge_items');
        });

        Schema::create('charge_item_sources', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('organization_id')->constrained('organizations');
            $table->uuid('item_id');
            $table->uuid('exercise_id');
            $table->string('source_kind', 20);
            $table->uuid('source_id');
            $table->unsignedBigInteger('amount');
            $table->datetimes(6);

            $table->unique(['item_id', 'source_kind', 'source_id'], 'charge_item_sources_item_source_unique');
            $table->index(['source_kind', 'source_id'], 'charge_item_sources_source_idx');
            $table->foreign('item_id', 'charge_item_sources_item_foreign')->references('id')->on('charge_items');
        });

        Schema::create('charge_source_locks', function (Blueprint $table): void {
            $table->string('source_kind', 20);
            $table->uuid('source_id');
            $table->foreignUuid('organization_id')->constrained('organizations');
            $table->primary(['source_kind', 'source_id']);
        });
    }

    private function statements(): void
    {
        Schema::create('charge_sequences', function (Blueprint $table): void {
            $table->foreignUuid('organization_id')->constrained('organizations');
            $table->unsignedSmallInteger('year');
            $table->unsignedBigInteger('last_value');
            $table->primary(['organization_id', 'year']);
        });

        Schema::create('charge_statements', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('organization_id')->constrained('organizations');
            $table->uuid('exercise_id');
            $table->uuid('lease_id');
            $table->string('number', 20)->nullable();
            $table->string('status', 12);
            $table->unsignedSmallInteger('occupied_days');
            $table->unsignedBigInteger('share_total');
            $table->unsignedBigInteger('provisions_called');
            $table->unsignedBigInteger('provisions_unpaid');
            $table->bigInteger('balance');
            $table->unsignedBigInteger('suggested_monthly_provision');
            $table->char('currency', 3);
            $table->string('settlement', 24)->nullable();
            $table->date('not_before')->nullable();
            $table->uuid('mandate_id')->nullable();
            $table->uuid('mandant_party_id')->nullable();
            $table->json('snapshot');
            $table->char('fingerprint', 64);
            $table->string('template_version', 12);
            $table->uuid('issued_document_id')->nullable();
            $table->uuid('stored_file_id')->nullable();
            $table->dateTime('issued_at', 6)->nullable();
            $table->date('visible_until')->nullable();
            $table->uuid('supersedes_id')->nullable();
            $table->string('rectification_reason', 255)->nullable();
            $table->string('failure_reason', 255)->nullable();
            $table->string('idempotency_key', 120)->nullable();
            $table->unsignedInteger('lock_version')->default(1);
            $table->datetimes(6);

            $table->unique(['organization_id', 'id']);
            $table->unique(['organization_id', 'number'], 'charge_statements_org_number_unique');
            $table->unique(['organization_id', 'idempotency_key'], 'charge_statements_org_key_unique');
            $table->index(['exercise_id', 'lease_id', 'status'], 'charge_statements_exercise_lease_idx');
            $table->index(['lease_id', 'status'], 'charge_statements_lease_status_idx');
            $table->foreign('exercise_id', 'charge_statements_exercise_foreign')->references('id')->on('charge_exercises');
        });

        Schema::create('charge_statement_lines', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('organization_id')->constrained('organizations');
            $table->uuid('statement_id');
            $table->uuid('item_id');
            $table->string('label', 120);
            $table->string('rubric', 64);
            $table->string('split_label', 120);
            $table->unsignedBigInteger('item_amount');
            $table->unsignedBigInteger('weight');
            $table->unsignedBigInteger('denominator');
            $table->unsignedSmallInteger('days');
            $table->unsignedBigInteger('share');
            $table->unsignedSmallInteger('position');
            $table->datetimes(6);

            $table->index(['statement_id', 'position'], 'charge_statement_lines_statement_idx');
            $table->foreign('statement_id', 'charge_statement_lines_statement_foreign')->references('id')->on('charge_statements');
        });

        Schema::create('charge_statement_files', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('organization_id')->constrained('organizations');
            $table->uuid('statement_id');
            $table->uuid('stored_file_id');
            $table->string('label', 120);
            $table->boolean('tenant_visible')->default(false);
            $table->date('visible_until')->nullable();
            $table->datetimes(6);

            $table->unique(['statement_id', 'stored_file_id'], 'charge_statement_files_statement_file_unique');
            $table->foreign('statement_id', 'charge_statement_files_statement_foreign')->references('id')->on('charge_statements');
        });

        Schema::create('charge_statement_plans', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('organization_id')->constrained('organizations');
            $table->uuid('statement_id');
            $table->string('reason', 255);
            $table->uuid('stored_file_id')->nullable();
            $table->string('idempotency_key', 120);
            $table->char('fingerprint', 64);
            $table->uuid('created_by_user_id')->nullable();
            $table->datetimes(6);

            $table->unique(['statement_id'], 'charge_statement_plans_statement_unique');
            $table->unique(['organization_id', 'idempotency_key'], 'charge_statement_plans_org_key_unique');
            $table->foreign('statement_id', 'charge_statement_plans_statement_foreign')->references('id')->on('charge_statements');
        });

        Schema::create('charge_idempotency', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('organization_id')->constrained('organizations');
            $table->string('scope', 32);
            $table->string('idempotency_key', 120);
            $table->char('fingerprint', 64);
            $table->uuid('target_id');
            $table->datetimes(6);

            $table->unique(['organization_id', 'scope', 'idempotency_key'], 'charge_idempotency_org_scope_key_unique');
        });

        Schema::create('charge_due_flags', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('organization_id')->constrained('organizations');
            $table->uuid('lease_id');
            $table->unsignedSmallInteger('year');
            $table->datetimes(6);

            $table->unique(['lease_id', 'year'], 'charge_due_flags_lease_year_unique');
        });
    }
};
