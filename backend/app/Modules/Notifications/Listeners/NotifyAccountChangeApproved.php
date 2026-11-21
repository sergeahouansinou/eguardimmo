<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Listeners;

use App\Modules\Notifications\Actions\CreateNotifications;
use App\Modules\Notifications\Data\NotificationInput;
use App\Modules\Notifications\Enums\NotificationType;
use App\Modules\Notifications\Support\RetriesWithBackoff;
use App\Modules\OwnerFunds\Events\PayoutAccountChangeApproved;
use Illuminate\Contracts\Queue\ShouldQueue;

final class NotifyAccountChangeApproved implements ShouldQueue
{
    use RetriesWithBackoff;

    public function __construct(private readonly CreateNotifications $notifications) {}

    public function handle(PayoutAccountChangeApproved $evenement): void
    {
        $this->notifications->handle(new NotificationInput(
            NotificationType::OwnerAccountChangeApproved,
            $evenement->organizationId,
            "account:{$evenement->requestId}:approved",
            [],
            null,
            $evenement->requestId,
            $evenement->mandantPartyId,
        ));
    }
}
