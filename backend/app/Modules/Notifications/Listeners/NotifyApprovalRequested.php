<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Listeners;

use App\Modules\Maintenance\Events\ApprovalRequested;
use App\Modules\Notifications\Actions\CreateNotifications;
use App\Modules\Notifications\Data\NotificationInput;
use App\Modules\Notifications\Enums\NotificationType;
use App\Modules\Notifications\Support\RetriesWithBackoff;
use Illuminate\Contracts\Queue\ShouldQueue;

final class NotifyApprovalRequested implements ShouldQueue
{
    use RetriesWithBackoff;

    public function __construct(private readonly CreateNotifications $notifications) {}

    public function handle(ApprovalRequested $evenement): void
    {
        $this->notifications->handle(new NotificationInput(
            NotificationType::OwnerApprovalRequested,
            $evenement->organizationId,
            "approval:{$evenement->approvalId}:requested",
            ['label' => $evenement->reference],
            null,
            $evenement->interventionId,
            $evenement->mandantPartyId,
        ));
    }
}
