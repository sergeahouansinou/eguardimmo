<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Listeners;

use App\Modules\Maintenance\Events\ApprovalExpired;
use App\Modules\Notifications\Actions\CreateNotifications;
use App\Modules\Notifications\Data\NotificationInput;
use App\Modules\Notifications\Enums\NotificationType;
use App\Modules\Notifications\Support\RetriesWithBackoff;
use Illuminate\Contracts\Queue\ShouldQueue;

final class NotifyApprovalExpired implements ShouldQueue
{
    use RetriesWithBackoff;

    public function __construct(private readonly CreateNotifications $notifications) {}

    public function handle(ApprovalExpired $evenement): void
    {
        $this->notifications->handle(new NotificationInput(
            NotificationType::MaintenanceApprovalExpired,
            $evenement->organizationId,
            "approval:{$evenement->approvalId}:expired",
            ['label' => $evenement->reference],
            null,
            $evenement->interventionId,
        ));
        $this->notifications->handle(new NotificationInput(
            NotificationType::OwnerApprovalExpired,
            $evenement->organizationId,
            "approval:{$evenement->approvalId}:expired",
            ['label' => $evenement->reference],
            null,
            $evenement->interventionId,
            $evenement->mandantPartyId,
        ));
    }
}
