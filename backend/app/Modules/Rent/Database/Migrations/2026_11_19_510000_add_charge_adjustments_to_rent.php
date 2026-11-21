<?php

declare(strict_types=1);

use App\Modules\Rent\Enums\AdjustmentStatus;
use App\Modules\Rent\Enums\InstallmentKind;
use App\Modules\Rent\Enums\PaymentMethod;
use App\Shared\Database\Checks;
use App\Shared\Database\RowGuards;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private const array COLONNES_AJUSTEMENT = ['id', 'organization_id', 'lease_id', 'source_type', 'source_id', 'position', 'label', 'amount', 'currency', 'not_before', 'created_at'];

    public function up(): void
    {
        Schema::table('installments', function (Blueprint $table): void {
            $table->string('kind', 12)->default(InstallmentKind::Periodic->value);
        });

        Schema::table('installments', function (Blueprint $table): void {
            $table->dropUnique(['lease_id', 'period_start']);
            $table->unique(['lease_id', 'kind', 'period_start'], 'installments_lease_kind_period_unique');
        });

        Schema::create('rent_adjustments', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('organization_id')->constrained('organizations');
            $table->uuid('lease_id');
            $table->string('source_type', 24);
            $table->uuid('source_id');
            $table->unsignedSmallInteger('position');
            $table->string('label', 255);
            $table->unsignedBigInteger('amount');
            $table->char('currency', 3);
            $table->date('not_before');
            $table->string('status', 12);
            $table->uuid('installment_id')->nullable();
            $table->datetimes(6);

            $table->unique(['organization_id', 'id']);
            $table->unique(['source_type', 'source_id', 'position'], 'rent_adjustments_source_position_unique');
            $table->index(['lease_id', 'status', 'not_before'], 'rent_adjustments_lease_status_idx');
            $table->foreign(['organization_id', 'lease_id'], 'rent_adjustments_org_lease_foreign')->references(['organization_id', 'lease_id'])->on('rent_schedules');
            $table->foreign(['organization_id', 'installment_id'], 'rent_adjustments_org_installment_foreign')->references(['organization_id', 'id'])->on('installments');
        });

        Schema::create('rent_advance_refunds', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('organization_id')->constrained('organizations');
            $table->uuid('lease_id');
            $table->uuid('payment_id');
            $table->unsignedBigInteger('amount');
            $table->char('currency', 3);
            $table->date('refunded_on');
            $table->string('source', 8);
            $table->string('reference', 120)->nullable();
            $table->uuid('ledger_entry_id');
            $table->string('idempotency_key', 120);
            $table->char('fingerprint', 64);
            $table->uuid('recorded_by_user_id')->nullable();
            $table->datetimes(6);

            $table->unique(['organization_id', 'id']);
            $table->unique(['organization_id', 'idempotency_key', 'payment_id'], 'rent_advance_refunds_key_payment_unique');
            $table->index(['payment_id'], 'rent_advance_refunds_payment_idx');
            $table->foreign(['organization_id', 'payment_id'], 'rent_advance_refunds_org_payment_foreign')->references(['organization_id', 'id'])->on('rent_payments');
        });

        Checks::add('installments', 'kind', Checks::enum('kind', InstallmentKind::class));
        Checks::add('rent_adjustments', 'status', Checks::enum('status', AdjustmentStatus::class));
        Checks::add('rent_adjustments', 'amount', 'amount > 0');
        Checks::add('rent_advance_refunds', 'amount', 'amount > 0');

        if (in_array(DB::getDriverName(), ['mysql', 'mariadb'], true)) {
            DB::statement('ALTER TABLE rent_payments DROP CHECK rent_payments_method_check');
            Checks::add('rent_payments', 'method', Checks::enum('method', PaymentMethod::class));
        }

        RowGuards::install([
            ...RowGuards::frozenExcept('rent_adjustments', [...self::COLONNES_AJUSTEMENT, 'status', 'installment_id', 'updated_at'], ['status', 'installment_id', 'updated_at']),
            ...RowGuards::frozenExcept('rent_advance_refunds', ['id', 'organization_id', 'lease_id', 'payment_id', 'amount', 'currency', 'refunded_on', 'source', 'reference', 'ledger_entry_id', 'idempotency_key', 'fingerprint', 'recorded_by_user_id', 'created_at', 'updated_at'], []),
        ]);
    }

    public function down(): void
    {
        Schema::dropIfExists('rent_advance_refunds');
        Schema::dropIfExists('rent_adjustments');
    }
};
