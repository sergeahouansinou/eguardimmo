<?php

declare(strict_types=1);

use App\Modules\Accounting\Enums\ItemType;
use App\Modules\Accounting\Enums\SourceType;
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

        foreach ([
            ['journal_entries', 'source_type', Checks::enum('source_type', SourceType::class)],
            ['journal_lines', 'item_type', Checks::enum('item_type', ItemType::class, nullable: true)],
        ] as [$table, $nom, $expression]) {
            DB::statement("ALTER TABLE {$table} DROP CHECK {$table}_{$nom}_check");
            Checks::add($table, $nom, $expression);
        }
    }

    public function down(): void
    {
        // Les contrôles élargis restent en place : des dépenses et des régularisations peuvent déjà être écrites.
    }
};
