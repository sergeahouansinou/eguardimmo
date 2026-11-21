<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Listeners;

use App\Modules\Maintenance\Events\VisitRescheduleRequested;
use App\Modules\Notifications\Actions\CreateNotifications;
use App\Modules\Notifications\Data\NotificationInput;
use App\Modules\Notifications\Enums\NotificationType;
use App\Modules\Notifications\Support\RetriesWithBackoff;
use Illuminate\Contracts\Queue\ShouldQueue;

final class NotifyVisitRescheduleRequested implements ShouldQueue
{
    use RetriesWithBackoff;

    public function __construct(private readonly CreateNotifications $notifications) {}

    public function handle(VisitRescheduleRequested $evenement): void
    {
        $this->notifications->handle(new NotificationInput(
            NotificationType::MaintenanceRescheduleRequested,
            $evenement->organizationId,
            "visit:{$evenement->visitId}:{$evenement->visitVersion}",
            ['label' => $evenement->reference],
            $evenement->leaseId,
            $evenement->interventionId,
        ));
    }
}
