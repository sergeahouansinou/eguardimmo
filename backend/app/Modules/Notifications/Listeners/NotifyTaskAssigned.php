<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Listeners;

use App\Modules\Notifications\Actions\CreateNotifications;
use App\Modules\Notifications\Data\NotificationInput;
use App\Modules\Notifications\Enums\NotificationType;
use App\Modules\Notifications\Support\RetriesWithBackoff;
use App\Modules\Planning\Events\TaskAssigned;
use Illuminate\Contracts\Queue\ShouldQueue;

final class NotifyTaskAssigned implements ShouldQueue
{
    use RetriesWithBackoff;

    public function __construct(private readonly CreateNotifications $notifications) {}

    public function handle(TaskAssigned $evenement): void
    {
        $this->notifications->handle(new NotificationInput(
            NotificationType::PlanningTaskAssigned,
            $evenement->organizationId,
            "task_assigned:{$evenement->taskId}:{$evenement->assigneeUserId}:{$evenement->lockVersion}",
            subjectId: $evenement->taskId,
            recipientId: $evenement->assigneeUserId,
        ));
    }
}
