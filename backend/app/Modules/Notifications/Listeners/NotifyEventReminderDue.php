<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Listeners;

use App\Modules\Notifications\Actions\CreateNotifications;
use App\Modules\Notifications\Data\NotificationInput;
use App\Modules\Notifications\Enums\NotificationType;
use App\Modules\Notifications\Support\RetriesWithBackoff;
use App\Modules\Planning\Events\EventReminderDue;
use Illuminate\Contracts\Queue\ShouldQueue;

final class NotifyEventReminderDue implements ShouldQueue
{
    use RetriesWithBackoff;

    public function __construct(private readonly CreateNotifications $notifications) {}

    public function handle(EventReminderDue $evenement): void
    {
        foreach ($evenement->recipientUserIds as $compte) {
            $this->notifications->handle(new NotificationInput(
                NotificationType::PlanningEventReminder,
                $evenement->organizationId,
                "event:{$evenement->eventId}:{$evenement->occurrenceOn}",
                ['date' => $evenement->occurrenceOn],
                subjectId: $evenement->eventId,
                recipientId: $compte,
            ));
        }
    }
}
