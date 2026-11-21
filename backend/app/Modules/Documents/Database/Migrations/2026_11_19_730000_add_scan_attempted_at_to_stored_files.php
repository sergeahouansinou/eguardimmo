<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('stored_files', function (Blueprint $table): void {
            $table->dateTime('scan_attempted_at', 6)->nullable();

            $table->index(['scan_status', 'scan_attempted_at'], 'stored_files_scan_attempt_index');
        });
    }

    public function down(): void
    {
        Schema::table('stored_files', function (Blueprint $table): void {
            $table->dropIndex('stored_files_scan_attempt_index');
            $table->dropColumn('scan_attempted_at');
        });
    }
};
