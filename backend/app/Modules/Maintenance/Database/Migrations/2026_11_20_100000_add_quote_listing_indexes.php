<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('intervention_quotes', function (Blueprint $table): void {
            $table->index(['organization_id', 'status', 'id'], 'intervention_quotes_org_status_id_idx');
            $table->index(['organization_id', 'supplier_party_id', 'id'], 'intervention_quotes_org_supplier_id_idx');
        });
    }

    public function down(): void
    {
        Schema::table('intervention_quotes', function (Blueprint $table): void {
            $table->dropIndex('intervention_quotes_org_status_id_idx');
            $table->dropIndex('intervention_quotes_org_supplier_id_idx');
        });
    }
};
