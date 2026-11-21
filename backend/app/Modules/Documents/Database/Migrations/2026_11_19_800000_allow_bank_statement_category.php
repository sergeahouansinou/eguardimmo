<?php

declare(strict_types=1);

use App\Modules\Documents\Enums\FileCategory;
use App\Shared\Database\Checks;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        if (! in_array(DB::getDriverName(), ['mysql', 'mariadb'], true)) {
            return;
        }

        DB::statement('ALTER TABLE stored_files DROP CHECK stored_files_category_check');
        Checks::add('stored_files', 'category', Checks::enum('category', FileCategory::class));
    }

    public function down(): void
    {
        // Le contrôle élargi reste en place : des relevés bancaires peuvent déjà être stockés.
    }
};
