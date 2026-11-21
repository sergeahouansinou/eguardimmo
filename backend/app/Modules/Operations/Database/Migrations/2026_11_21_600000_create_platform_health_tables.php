<?php

declare(strict_types=1);

use App\Modules\Operations\Enums\BackupKind;
use App\Modules\Operations\Enums\RestoreResult;
use App\Modules\Operations\Enums\TaskStatus;
use App\Shared\Database\Checks;
use App\Shared\Database\RowGuards;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('scheduled_task_runs', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('command', 120);
            $table->string('expression', 64);
            $table->dateTime('last_started_at', 6);
            $table->dateTime('last_finished_at', 6)->nullable();
            $table->unsignedInteger('last_duration_ms')->nullable();
            $table->string('last_status', 12);
            $table->dateTime('last_failed_at', 6)->nullable();
            $table->string('last_error_class', 120)->nullable();
            $table->datetimes(6);

            $table->unique('command', 'scheduled_task_runs_command_unique');
        });

        Schema::create('backup_reports', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('kind', 16);
            $table->dateTime('started_at', 6);
            $table->unsignedInteger('duration_seconds');
            $table->unsignedBigInteger('size_bytes')->nullable();
            $table->boolean('succeeded');
            $table->string('manifest_sha256', 64)->nullable();
            $table->string('restore_test_target', 40)->nullable();
            $table->string('restore_test_result', 8)->nullable();
            $table->dateTime('created_at', 6);

            $table->index(['kind', 'succeeded', 'started_at'], 'backup_reports_kind_success_idx');
        });

        Checks::add('scheduled_task_runs', 'last_status', Checks::enum('last_status', TaskStatus::class));
        Checks::add('backup_reports', 'kind', Checks::enum('kind', BackupKind::class));
        Checks::add('backup_reports', 'restore_test_result', Checks::enum('restore_test_result', RestoreResult::class, true));
        Checks::add('backup_reports', 'restore_test', "kind <> 'restore_test' OR (restore_test_target IS NOT NULL AND restore_test_result IS NOT NULL)");

        RowGuards::install([
            ['backup_reports_ajout_seul', 'BEFORE UPDATE', 'backup_reports', '1 = 1', 'backup_reports : preuve non modifiable'],
        ]);
    }

    public function down(): void
    {
        Schema::dropIfExists('backup_reports');
        Schema::dropIfExists('scheduled_task_runs');
    }
};
