<?php

declare(strict_types=1);

use App\Shared\Database\Checks;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('forecast_assumptions', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('organization_id')->constrained('organizations');
            $table->decimal('indexation_rate', 6, 3)->default(0);
            $table->decimal('expense_growth_rate', 6, 3)->default(0);
            $table->json('vacancies');
            $table->json('one_off_expenses');
            $table->unsignedInteger('lock_version')->default(1);
            $table->datetimes(6);

            $table->unique('organization_id', 'forecast_assumptions_org_unique');
        });

        Checks::add('forecast_assumptions', 'rates', 'indexation_rate BETWEEN 0 AND 10 AND expense_growth_rate BETWEEN 0 AND 10');
    }

    public function down(): void
    {
        Schema::dropIfExists('forecast_assumptions');
    }
};
