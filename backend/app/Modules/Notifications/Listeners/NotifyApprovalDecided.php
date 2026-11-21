<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Listeners;

use App\Modules\Maintenance\Events\ApprovalDecided;
use App\Modules\Notifications\Actions\CreateNotifications;
use App\Modules\Notifications\Data\NotificationInput;
use App\Modules\Notifications\Enums\NotificationType;
use App\Modules\Notifications\Support\RetriesWithBackoff;
use Illuminate\Contracts\Queue\ShouldQueue;

final class NotifyApprovalDecided implements ShouldQueue
{
    use RetriesWithBackoff;

    public function __construct(private readonly CreateNotifications $notifications) {}

    public function handle(ApprovalDecided $evenement): void
    {
        $this->notifications->handle(new NotificationInput(
            NotificationType::MaintenanceApprovalDecided,
            $evenement->organizationId,
            "approval:{$evenement->approvalId}:{$evenement->status}",
            ['label' => $evenement->reference],
            null,
            $evenement->interventionId,
        ));

        if ($evenement->decidedVia === 'agency_recorded') {
            $this->notifications->handle(new NotificationInput(
                NotificationType::OwnerApprovalRecorded,
                $evenement->organizationId,
                "approval:{$evenement->approvalId}:recorded",
                ['label' => $evenement->reference],
                null,
                $evenement->interventionId,
                $evenement->mandantPartyId,
            ));
        }
    }
}
