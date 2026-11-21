<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('mandate_documents', function (Blueprint $table): void {
            $table->unsignedTinyInteger('live_key')->nullable()->virtualAs('CASE WHEN revoked_at IS NULL THEN 1 END');
            $table->unique(['mandate_id', 'stored_file_id', 'live_key'], 'mandate_documents_live_unique');
        });
    }

    public function down(): void
    {
        Schema::table('mandate_documents', function (Blueprint $table): void {
            $table->dropUnique('mandate_documents_live_unique');
            $table->dropColumn('live_key');
        });
    }
};
