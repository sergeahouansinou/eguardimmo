<?php

declare(strict_types=1);

use App\Modules\Mandates\Enums\FeeBase;
use App\Modules\Mandates\Enums\FeeTaxMode;
use App\Shared\Database\Checks;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('mandate_terms', function (Blueprint $table): void {
            $table->string('fee_base', 16)->nullable();
            $table->unsignedBigInteger('fee_minimum_amount')->default(0);
            $table->string('fee_tax_mode', 12)->default(FeeTaxMode::ExclTax->value);
        });

        Checks::add('mandate_terms', 'fee_base', Checks::enum('fee_base', FeeBase::class, nullable: true));
        Checks::add('mandate_terms', 'fee_tax_mode', Checks::enum('fee_tax_mode', FeeTaxMode::class));
    }

    public function down(): void
    {
        Schema::table('mandate_terms', function (Blueprint $table): void {
            $table->dropColumn(['fee_base', 'fee_minimum_amount', 'fee_tax_mode']);
        });
    }
};
