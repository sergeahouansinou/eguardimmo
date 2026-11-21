<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Listeners;

use App\Modules\Notifications\Actions\CreateNotifications;
use App\Modules\Notifications\Data\NotificationInput;
use App\Modules\Notifications\Enums\NotificationType;
use App\Modules\Notifications\Support\RetriesWithBackoff;
use App\Modules\Payments\Events\OnlinePaymentFailed;
use Illuminate\Contracts\Queue\ShouldQueue;

final class NotifyOnlinePaymentFailed implements ShouldQueue
{
    use RetriesWithBackoff;

    public function __construct(private readonly CreateNotifications $notifications) {}

    public function handle(OnlinePaymentFailed $evenement): void
    {
        $this->notifications->handle(new NotificationInput(
            NotificationType::TenantOnlinePaymentFailed,
            $evenement->organizationId,
            "online_payment:{$evenement->onlinePaymentId}:failed",
            leaseId: $evenement->leaseId,
            subjectId: $evenement->onlinePaymentId,
            partyId: $evenement->partyId,
        ));
    }
}
