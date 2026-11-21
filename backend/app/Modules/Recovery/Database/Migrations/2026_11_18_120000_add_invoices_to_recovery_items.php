<?php

declare(strict_types=1);

use App\Modules\Recovery\Enums\ItemType;
use App\Shared\Database\Checks;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private const array TABLES = ['recovery_case_items', 'recovery_item_claims'];

    public function up(): void
    {
        Schema::table('recovery_case_items', function (Blueprint $table): void {
            $table->string('reference', 40)->nullable()->after('item_id');
        });

        $this->remplacerContrainte(Checks::enum('item_type', ItemType::class));
        Checks::add('recovery_case_items', 'invoice_reference', "item_type <> 'invoice' OR reference IS NOT NULL");
    }

    public function down(): void
    {
        if (DB::table('recovery_case_items')->where('item_type', ItemType::Invoice->value)->exists()) {
            throw new RuntimeException('Des factures figurent dans des dossiers de recouvrement : la migration ne se défait pas sans supprimer de données.');
        }

        if (in_array(DB::getDriverName(), ['mysql', 'mariadb'], true)) {
            DB::statement('ALTER TABLE recovery_case_items DROP CHECK recovery_case_items_invoice_reference_check');
        }

        $this->remplacerContrainte("item_type IN ('installment')");

        Schema::table('recovery_case_items', function (Blueprint $table): void {
            $table->dropColumn('reference');
        });
    }

    private function remplacerContrainte(string $expression): void
    {
        if (! in_array(DB::getDriverName(), ['mysql', 'mariadb'], true)) {
            return;
        }

        foreach (self::TABLES as $table) {
            DB::statement("ALTER TABLE {$table} DROP CHECK {$table}_item_type_check");
            DB::statement(Checks::statement($table, 'item_type', $expression));
        }
    }
};
