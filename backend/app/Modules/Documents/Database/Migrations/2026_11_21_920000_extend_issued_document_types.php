<?php

declare(strict_types=1);

use App\Modules\Documents\Enums\IssuedDocumentType;
use App\Shared\Database\Checks;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        if (in_array(DB::getDriverName(), ['mysql', 'mariadb'], true)) {
            DB::statement('ALTER TABLE issued_documents DROP CHECK issued_documents_type_check');
            Checks::add('issued_documents', 'type', Checks::enum('type', IssuedDocumentType::class));
        }
    }

    public function down(): void
    {
        // Le contrôle élargi reste en place : une pièce `tax_summary` peut déjà exister.
    }
};
