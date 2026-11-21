<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Listeners;

use App\Modules\Inspections\Events\InspectionRemarkReceived;
use App\Modules\Notifications\Actions\CreateNotifications;
use App\Modules\Notifications\Data\NotificationInput;
use App\Modules\Notifications\Enums\NotificationType;
use App\Modules\Notifications\Support\RetriesWithBackoff;
use Illuminate\Contracts\Queue\ShouldQueue;

final class NotifyInspectionRemarkReceived implements ShouldQueue
{
    use RetriesWithBackoff;

    public function __construct(private readonly CreateNotifications $notifications) {}

    public function handle(InspectionRemarkReceived $evenement): void
    {
        $this->notifications->handle(new NotificationInput(
            NotificationType::InspectionsRemarkReceived,
            $evenement->organizationId,
            "remark:{$evenement->remarkId}",
            leaseId: $evenement->leaseId,
            subjectId: $evenement->inspectionId,
        ));
    }
}
