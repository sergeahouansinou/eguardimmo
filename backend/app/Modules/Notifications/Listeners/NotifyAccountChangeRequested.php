<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Listeners;

use App\Modules\Notifications\Actions\CreateNotifications;
use App\Modules\Notifications\Data\NotificationInput;
use App\Modules\Notifications\Enums\NotificationType;
use App\Modules\Notifications\Support\RetriesWithBackoff;
use App\Modules\OwnerFunds\Events\PayoutAccountChangeRequested;
use Illuminate\Contracts\Queue\ShouldQueue;

final class NotifyAccountChangeRequested implements ShouldQueue
{
    use RetriesWithBackoff;

    public function __construct(private readonly CreateNotifications $notifications) {}

    public function handle(PayoutAccountChangeRequested $evenement): void
    {
        $this->notifications->handle(new NotificationInput(
            NotificationType::OwnerAccountChangeRequested,
            $evenement->organizationId,
            "account:{$evenement->requestId}:requested",
            [],
            null,
            $evenement->requestId,
            $evenement->mandantPartyId,
        ));
    }
}
