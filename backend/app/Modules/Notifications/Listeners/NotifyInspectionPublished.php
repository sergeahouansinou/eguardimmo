<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Listeners;

use App\Modules\Inspections\Events\InspectionPublished;
use App\Modules\Notifications\Actions\CreateNotifications;
use App\Modules\Notifications\Data\NotificationInput;
use App\Modules\Notifications\Enums\NotificationType;
use App\Modules\Notifications\Support\RetriesWithBackoff;
use Illuminate\Contracts\Queue\ShouldQueue;

final class NotifyInspectionPublished implements ShouldQueue
{
    use RetriesWithBackoff;

    public function __construct(private readonly CreateNotifications $notifications) {}

    public function handle(InspectionPublished $evenement): void
    {
        $this->notifications->handle(new NotificationInput(
            NotificationType::TenantInspectionPublished,
            $evenement->organizationId,
            "inspection:{$evenement->inspectionId}",
            leaseId: $evenement->leaseId,
            subjectId: $evenement->inspectionId,
        ));
    }
}
