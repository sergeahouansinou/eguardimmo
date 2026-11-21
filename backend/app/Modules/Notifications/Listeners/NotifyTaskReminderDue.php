<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Listeners;

use App\Modules\Notifications\Actions\CreateNotifications;
use App\Modules\Notifications\Data\NotificationInput;
use App\Modules\Notifications\Enums\NotificationType;
use App\Modules\Notifications\Support\RetriesWithBackoff;
use App\Modules\Planning\Events\TaskReminderDue;
use Illuminate\Contracts\Queue\ShouldQueue;

final class NotifyTaskReminderDue implements ShouldQueue
{
    use RetriesWithBackoff;

    public function __construct(private readonly CreateNotifications $notifications) {}

    public function handle(TaskReminderDue $evenement): void
    {
        $this->notifications->handle(new NotificationInput(
            NotificationType::PlanningTaskDue,
            $evenement->organizationId,
            "task_due:{$evenement->taskId}:{$evenement->dueOn}",
            ['date' => $evenement->dueOn],
            subjectId: $evenement->taskId,
            recipientId: $evenement->assigneeUserId,
        ));
    }
}
