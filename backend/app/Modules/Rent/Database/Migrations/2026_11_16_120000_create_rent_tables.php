<?php

declare(strict_types=1);

use App\Modules\Rent\Enums\DocumentSequenceKind;
use App\Modules\Rent\Enums\InstallmentStatus;
use App\Modules\Rent\Enums\PaymentMethod;
use App\Modules\Rent\Enums\PaymentStatus;
use App\Shared\Database\Checks;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('rent_sequences', function (Blueprint $table): void {
            $table->foreignUuid('organization_id')->constrained('organizations');
            $table->string('kind', 16);
            $table->unsignedSmallInteger('year');
            $table->unsignedInteger('last_value')->default(0);

            $table->primary(['organization_id', 'kind', 'year']);
        });

        Schema::create('rent_schedules', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('organization_id')->constrained('organizations');
            $table->uuid('lease_id');
            $table->date('billing_from');
            $table->datetimes(6);

            $table->unique(['organization_id', 'id']);
            $table->unique(['organization_id', 'lease_id']);
        });

        Schema::create('installments', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('organization_id')->constrained('organizations');
            $table->uuid('lease_id');
            $table->uuid('party_id')->nullable();
            $table->uuid('unit_id')->nullable();
            $table->date('period_start');
            $table->date('period_end');
            $table->date('due_date');
            $table->string('status', 16);
            $table->char('currency', 3);
            $table->unsignedBigInteger('rent_amount');
            $table->unsignedBigInteger('charges_amount');
            $table->unsignedBigInteger('vat_amount');
            $table->unsignedBigInteger('total_amount');
            $table->date('issued_on')->nullable();
            $table->uuid('ledger_entry_id')->nullable();
            $table->date('cancelled_on')->nullable();
            $table->string('cancellation_reason', 255)->nullable();
            $table->dateTime('overdue_notified_at', 6)->nullable();
            $table->datetimes(6);

            $table->unique(['organization_id', 'id']);
            $table->unique(['lease_id', 'period_start']);
            $table->index(['organization_id', 'status', 'due_date']);
            $table->index(['organization_id', 'lease_id', 'due_date']);
            $table->foreign(['organization_id', 'lease_id'])->references(['organization_id', 'lease_id'])->on('rent_schedules');
        });

        Schema::create('installment_lines', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('organization_id')->constrained('organizations');
            $table->uuid('installment_id');
            $table->unsignedSmallInteger('position');
            $table->string('component_key', 80);
            $table->string('semantic', 32);
            $table->string('label', 255);
            $table->date('from_date');
            $table->date('to_date');
            $table->unsignedSmallInteger('days');
            $table->unsignedSmallInteger('month_days');
            $table->char('currency', 3);
            $table->unsignedBigInteger('monthly_amount');
            $table->unsignedBigInteger('amount');
            $table->unsignedSmallInteger('vat_bp');
            $table->unsignedBigInteger('vat_amount');
            $table->datetimes(6);

            $table->unique(['organization_id', 'id']);
            $table->unique(['installment_id', 'position']);
            $table->foreign(['organization_id', 'installment_id'])->references(['organization_id', 'id'])->on('installments');
        });

        Schema::create('rent_payments', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('organization_id')->constrained('organizations');
            $table->uuid('lease_id');
            $table->uuid('party_id')->nullable();
            $table->string('status', 16);
            $table->string('method', 16);
            $table->unsignedBigInteger('amount');
            $table->char('currency', 3);
            $table->date('received_on');
            $table->string('reference', 120)->nullable();
            $table->string('note', 500)->nullable();
            $table->string('idempotency_key', 120);
            $table->char('fingerprint', 64);
            $table->uuid('ledger_entry_id')->nullable();
            $table->date('cancelled_on')->nullable();
            $table->string('cancellation_reason', 255)->nullable();
            $table->uuid('recorded_by_user_id')->nullable();
            $table->datetimes(6);

            $table->unique(['organization_id', 'id']);
            $table->unique(['organization_id', 'idempotency_key']);
            $table->index(['organization_id', 'lease_id', 'received_on']);
            $table->foreign(['organization_id', 'lease_id'])->references(['organization_id', 'lease_id'])->on('rent_schedules');
        });

        Schema::create('rent_payment_allocations', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('organization_id')->constrained('organizations');
            $table->uuid('payment_id');
            $table->uuid('installment_id');
            $table->unsignedBigInteger('amount');
            $table->char('currency', 3);
            $table->uuid('ledger_entry_id');
            $table->dateTime('reversed_at', 6)->nullable();
            $table->datetimes(6);

            $table->unique(['organization_id', 'id']);
            $table->index(['installment_id', 'reversed_at']);
            $table->index(['payment_id', 'reversed_at']);
            $table->foreign(['organization_id', 'payment_id'])->references(['organization_id', 'id'])->on('rent_payments');
            $table->foreign(['organization_id', 'installment_id'])->references(['organization_id', 'id'])->on('installments');
        });

        Schema::create('rent_notices', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('organization_id')->constrained('organizations');
            $table->uuid('installment_id');
            $table->string('number', 24);
            $table->uuid('issued_document_id');
            $table->uuid('stored_file_id');
            $table->char('fingerprint', 64);
            $table->string('template_version', 32);
            $table->json('snapshot');
            $table->date('issued_on');
            $table->uuid('issued_by_user_id')->nullable();
            $table->datetimes(6);

            $table->unique(['organization_id', 'id']);
            $table->unique(['organization_id', 'number']);
            $table->unique('installment_id');
            $table->foreign(['organization_id', 'installment_id'])->references(['organization_id', 'id'])->on('installments');
        });

        Schema::create('rent_receipts', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('organization_id')->constrained('organizations');
            $table->uuid('lease_id');
            $table->uuid('installment_id');
            $table->string('number', 24);
            $table->uuid('issued_document_id');
            $table->uuid('stored_file_id');
            $table->char('fingerprint', 64);
            $table->string('template_version', 32);
            $table->json('snapshot');
            $table->char('currency', 3);
            $table->unsignedBigInteger('rent_amount');
            $table->unsignedBigInteger('charges_amount');
            $table->unsignedBigInteger('vat_amount');
            $table->unsignedBigInteger('total_amount');
            $table->date('issued_on');
            $table->dateTime('voided_at', 6)->nullable();
            $table->string('void_reason', 255)->nullable();
            $table->uuid('issued_by_user_id')->nullable();
            $table->uuid('active_installment_id')->nullable()->virtualAs('CASE WHEN voided_at IS NULL THEN installment_id END');
            $table->datetimes(6);

            $table->unique(['organization_id', 'id']);
            $table->unique(['organization_id', 'number']);
            $table->unique('active_installment_id');
            $table->index(['organization_id', 'lease_id', 'issued_on']);
            $table->foreign(['organization_id', 'installment_id'])->references(['organization_id', 'id'])->on('installments');
        });

        Checks::add('rent_sequences', 'kind', Checks::enum('kind', DocumentSequenceKind::class));
        Checks::add('installments', 'status', Checks::enum('status', InstallmentStatus::class));
        Checks::add('installments', 'currency', Checks::uppercase('currency', 3));
        Checks::add('installments', 'period', 'period_end >= period_start');
        Checks::add('installments', 'total', 'total_amount = rent_amount + charges_amount + vat_amount AND total_amount > 0');
        Checks::add('installments', 'issued', "status IN ('upcoming', 'cancelled') OR issued_on IS NOT NULL");
        Checks::add('installment_lines', 'period', 'to_date >= from_date AND days > 0 AND days <= month_days');
        Checks::add('installment_lines', 'vat', 'vat_bp BETWEEN 0 AND 10000');
        Checks::add('rent_payments', 'status', Checks::enum('status', PaymentStatus::class));
        Checks::add('rent_payments', 'method', Checks::enum('method', PaymentMethod::class));
        Checks::add('rent_payments', 'currency', Checks::uppercase('currency', 3));
        Checks::add('rent_payments', 'amount', 'amount > 0');
        Checks::add('rent_payment_allocations', 'amount', 'amount > 0');
        Checks::add('rent_receipts', 'total', 'total_amount = rent_amount + charges_amount + vat_amount');
    }

    public function down(): void
    {
        Schema::dropIfExists('rent_receipts');
        Schema::dropIfExists('rent_notices');
        Schema::dropIfExists('rent_payment_allocations');
        Schema::dropIfExists('rent_payments');
        Schema::dropIfExists('installment_lines');
        Schema::dropIfExists('installments');
        Schema::dropIfExists('rent_schedules');
        Schema::dropIfExists('rent_sequences');
    }
};
