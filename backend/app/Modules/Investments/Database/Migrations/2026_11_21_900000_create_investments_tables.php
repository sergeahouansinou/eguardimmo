<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('property_acquisitions', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('organization_id')->constrained('organizations');
            $table->uuid('property_id');
            $table->uuid('unit_id')->nullable();
            $table->string('scope_key', 36);
            $table->date('acquired_on');
            $table->char('currency', 3);
            $table->unsignedBigInteger('price');
            $table->unsignedBigInteger('acquisition_costs')->default(0);
            $table->unsignedBigInteger('agency_fees')->default(0);
            $table->unsignedBigInteger('initial_works')->default(0);
            $table->uuid('stored_file_id')->nullable();
            $table->string('idempotency_key', 120);
            $table->char('fingerprint', 64);
            $table->unsignedInteger('lock_version')->default(1);
            $table->datetimes(6);

            $table->unique(['organization_id', 'id']);
            $table->unique(['organization_id', 'idempotency_key'], 'acq_org_key_unique');
            $table->unique(['organization_id', 'property_id', 'scope_key'], 'acq_org_property_scope_unique');
        });

        Schema::create('loans', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('organization_id')->constrained('organizations');
            $table->uuid('property_id');
            $table->uuid('unit_id')->nullable();
            $table->string('lender_label', 120);
            $table->string('contract_reference', 64)->nullable();
            $table->string('purpose', 16);
            $table->char('currency', 3);
            $table->unsignedBigInteger('principal');
            $table->decimal('nominal_rate', 8, 5);
            $table->date('first_due_on');
            $table->unsignedSmallInteger('term_months');
            $table->string('deferral_kind', 8);
            $table->unsignedSmallInteger('deferral_months')->default(0);
            $table->string('insurance_mode', 24);
            $table->decimal('insurance_rate', 8, 5)->nullable();
            $table->unsignedBigInteger('insurance_amount')->nullable();
            $table->uuid('replaces_loan_id')->nullable();
            $table->string('schedule_source', 12);
            $table->string('status', 12);
            $table->string('void_reason', 255)->nullable();
            $table->date('repaid_on')->nullable();
            $table->uuid('stored_file_id')->nullable();
            $table->string('idempotency_key', 120);
            $table->char('fingerprint', 64);
            $table->unsignedInteger('lock_version')->default(1);
            $table->datetimes(6);

            $table->unique(['organization_id', 'id']);
            $table->unique(['organization_id', 'idempotency_key'], 'loans_org_key_unique');
            $table->index(['organization_id', 'property_id', 'status'], 'loans_property_status_idx');
        });

        Schema::create('loan_schedules', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('organization_id')->constrained('organizations');
            $table->uuid('loan_id');
            $table->unsignedSmallInteger('version');
            $table->date('effective_from');
            $table->string('reason', 16);
            $table->datetimes(6);

            $table->unique(['organization_id', 'id']);
            $table->unique(['loan_id', 'version'], 'loan_schedules_loan_version_unique');
        });

        Schema::create('loan_schedule_lines', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('organization_id')->constrained('organizations');
            $table->uuid('loan_schedule_id');
            $table->uuid('loan_id');
            $table->unsignedSmallInteger('position');
            $table->date('due_on');
            $table->char('currency', 3);
            $table->unsignedBigInteger('payment');
            $table->unsignedBigInteger('interest');
            $table->unsignedBigInteger('principal');
            $table->unsignedBigInteger('insurance');
            $table->unsignedBigInteger('outstanding_after');
            $table->datetimes(6);

            $table->unique(['loan_schedule_id', 'position'], 'loan_lines_schedule_position_unique');
            $table->index(['organization_id', 'loan_id', 'due_on'], 'loan_lines_loan_due_idx');
        });

        Schema::create('loan_fees', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('organization_id')->constrained('organizations');
            $table->uuid('loan_id');
            $table->string('kind', 24);
            $table->date('paid_on');
            $table->char('currency', 3);
            $table->unsignedBigInteger('amount');
            $table->uuid('stored_file_id')->nullable();
            $table->datetimes(6);

            $table->index(['organization_id', 'loan_id', 'paid_on'], 'loan_fees_loan_paid_idx');
        });

        Schema::create('loan_interest_attestations', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('organization_id')->constrained('organizations');
            $table->uuid('loan_id');
            $table->unsignedSmallInteger('income_year');
            $table->char('currency', 3);
            $table->unsignedBigInteger('interest');
            $table->unsignedBigInteger('insurance')->default(0);
            $table->unsignedBigInteger('fees')->default(0);
            $table->uuid('stored_file_id');
            $table->datetimes(6);

            $table->unique(['loan_id', 'income_year'], 'loan_attest_loan_year_unique');
        });

        Schema::create('loan_usages', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('organization_id')->constrained('organizations');
            $table->uuid('loan_id');
            $table->unsignedSmallInteger('income_year');
            $table->datetimes(6);

            $table->unique(['loan_id', 'income_year'], 'loan_usages_loan_year_unique');
        });
    }

    public function down(): void
    {
        foreach (['loan_usages', 'loan_interest_attestations', 'loan_fees', 'loan_schedule_lines', 'loan_schedules', 'loans', 'property_acquisitions'] as $table) {
            Schema::dropIfExists($table);
        }
    }
};
