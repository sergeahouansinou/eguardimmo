<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Listeners;

use App\Modules\Inspections\Events\InspectionRemarkAnswered;
use App\Modules\Notifications\Actions\CreateNotifications;
use App\Modules\Notifications\Data\NotificationInput;
use App\Modules\Notifications\Enums\NotificationType;
use App\Modules\Notifications\Support\RetriesWithBackoff;
use Illuminate\Contracts\Queue\ShouldQueue;

final class NotifyInspectionRemarkAnswered implements ShouldQueue
{
    use RetriesWithBackoff;

    public function __construct(private readonly CreateNotifications $notifications) {}

    public function handle(InspectionRemarkAnswered $evenement): void
    {
        $this->notifications->handle(new NotificationInput(
            NotificationType::TenantInspectionRemarkAnswered,
            $evenement->organizationId,
            "remark:{$evenement->remarkId}:answered",
            leaseId: $evenement->leaseId,
            subjectId: $evenement->inspectionId,
            partyId: $evenement->partyId,
        ));
    }
}
