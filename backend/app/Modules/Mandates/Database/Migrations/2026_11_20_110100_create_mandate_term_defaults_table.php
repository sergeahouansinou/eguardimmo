<?php

declare(strict_types=1);

use App\Modules\Mandates\Enums\FeeBase;
use App\Modules\Mandates\Enums\FeeKind;
use App\Modules\Mandates\Enums\FeeTaxMode;
use App\Shared\Database\Checks;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('mandate_term_defaults', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('organization_id')->constrained('organizations');
            $table->string('fee_kind', 16);
            $table->unsignedSmallInteger('fee_basis_points')->nullable();
            $table->unsignedBigInteger('fee_flat_amount')->nullable();
            $table->char('currency', 3);
            $table->string('fee_base', 16);
            $table->unsignedBigInteger('fee_minimum_amount')->default(0);
            $table->string('fee_tax_mode', 12)->default(FeeTaxMode::ExclTax->value);
            $table->unsignedTinyInteger('payout_day');
            $table->unsignedBigInteger('works_limit_amount')->default(0);
            $table->unsignedSmallInteger('letting_fee_basis_points')->nullable();
            $table->unsignedSmallInteger('works_fee_basis_points')->nullable();
            $table->unsignedInteger('lock_version')->default(1);
            $table->uuid('updated_by_user_id')->nullable();
            $table->datetimes(6);

            $table->unique('organization_id');
        });

        Checks::add('mandate_term_defaults', 'currency', Checks::uppercase('currency', 3));
        Checks::add('mandate_term_defaults', 'fee_kind', Checks::enum('fee_kind', FeeKind::class));
        Checks::add('mandate_term_defaults', 'fee', "(fee_kind = 'percentage' AND fee_basis_points IS NOT NULL AND fee_basis_points BETWEEN 0 AND 10000 AND fee_flat_amount IS NULL)"
            ." OR (fee_kind = 'flat' AND fee_flat_amount IS NOT NULL AND fee_basis_points IS NULL)");
        Checks::add('mandate_term_defaults', 'fee_base', Checks::enum('fee_base', FeeBase::class));
        Checks::add('mandate_term_defaults', 'fee_tax_mode', Checks::enum('fee_tax_mode', FeeTaxMode::class));
        Checks::add('mandate_term_defaults', 'payout_day', 'payout_day BETWEEN 1 AND 28');
        Checks::add('mandate_term_defaults', 'letting_fee_bp', 'letting_fee_basis_points IS NULL OR letting_fee_basis_points BETWEEN 0 AND 10000');
        Checks::add('mandate_term_defaults', 'works_fee_bp', 'works_fee_basis_points IS NULL OR works_fee_basis_points BETWEEN 0 AND 10000');
    }

    public function down(): void
    {
        Schema::dropIfExists('mandate_term_defaults');
    }
};
