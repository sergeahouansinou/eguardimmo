<?php

declare(strict_types=1);

namespace App\Modules\Operations;

use App\Modules\Operations\Console\ExecuteApprovalCommand;
use App\Modules\Operations\Console\ExpireApprovalsCommand;
use App\Modules\Operations\Console\RecordBackupCommand;
use App\Modules\Operations\Models\BackupReport;
use App\Modules\Operations\Models\OperatorApproval;
use App\Modules\Operations\Models\ScheduledTaskRun;
use App\Modules\Operations\Queries\Approvals;
use App\Shared\Approval\ApprovalHandlers;
use Illuminate\Database\Eloquent\Relations\Relation;
use Illuminate\Support\ServiceProvider;

final class OperationsServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        $this->app->make(ApprovalHandlers::class)->resolvePending(fn (string $action, string $sujet): bool => $this->app->make(Approvals::class)->hasLivePending($action, $sujet));

        Relation::enforceMorphMap([
            'operator_approval' => OperatorApproval::class,
            'backup_report' => BackupReport::class,
            'scheduled_task_run' => ScheduledTaskRun::class,
        ]);

        if ($this->app->runningInConsole()) {
            $this->commands([ExpireApprovalsCommand::class, ExecuteApprovalCommand::class, RecordBackupCommand::class]);
        }
    }
}
