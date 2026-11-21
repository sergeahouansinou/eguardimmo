<?php

declare(strict_types=1);

use App\Modules\Rent\Enums\PaymentMethod;
use App\Shared\Database\Checks;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('rent_payments', function (Blueprint $table): void {
            $table->string('provider_reference', 120)->nullable();
            $table->unique(['organization_id', 'provider_reference'], 'rent_payments_provider_reference_unique');
        });

        if (in_array(DB::getDriverName(), ['mysql', 'mariadb'], true)) {
            DB::statement('ALTER TABLE rent_payments DROP CHECK rent_payments_method_check');
            Checks::add('rent_payments', 'method', Checks::enum('method', PaymentMethod::class));
        }
    }

    public function down(): void
    {
        Schema::table('rent_payments', function (Blueprint $table): void {
            $table->dropUnique('rent_payments_provider_reference_unique');
            $table->dropColumn('provider_reference');
        });
    }
};
