<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('journal_lines', function (Blueprint $table): void {
            $table->index(['organization_id', 'account_id', 'unit_id', 'journal_entry_id'], 'journal_lines_org_account_unit_entry_idx');
        });
    }

    public function down(): void
    {
        Schema::table('journal_lines', function (Blueprint $table): void {
            $table->dropIndex('journal_lines_org_account_unit_entry_idx');
        });
    }
};
