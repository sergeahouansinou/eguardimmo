<?php

declare(strict_types=1);

use App\Modules\Documents\Enums\ScanStatus;
use App\Shared\Database\Checks;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('stored_files', function (Blueprint $table): void {
            $table->string('scan_status', 16)->default(ScanStatus::Clean->value);
            $table->dateTime('scanned_at', 6)->nullable();

            $table->index(['scan_status', 'created_at'], 'stored_files_scan_status_index');
        });

        Checks::add('stored_files', 'scan_status', Checks::enum('scan_status', ScanStatus::class));
    }

    public function down(): void
    {
        if (in_array(DB::getDriverName(), ['mysql', 'mariadb'], true)) {
            DB::statement('ALTER TABLE stored_files DROP CHECK stored_files_scan_status_check');
        }

        Schema::table('stored_files', function (Blueprint $table): void {
            $table->dropIndex('stored_files_scan_status_index');
            $table->dropColumn(['scan_status', 'scanned_at']);
        });
    }
};
