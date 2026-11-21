<?php

declare(strict_types=1);

namespace App\Modules\Planning\Events;

use Illuminate\Contracts\Events\ShouldDispatchAfterCommit;
use Illuminate\Foundation\Events\Dispatchable;

final readonly class TaskReminderDue implements ShouldDispatchAfterCommit
{
    use Dispatchable;

    public function __construct(
        public string $taskId,
        public string $organizationId,
        public string $assigneeUserId,
        public string $dueOn,
    ) {}
}
