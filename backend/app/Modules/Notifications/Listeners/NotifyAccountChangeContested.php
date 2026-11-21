<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Listeners;

use App\Modules\Notifications\Actions\CreateNotifications;
use App\Modules\Notifications\Data\NotificationInput;
use App\Modules\Notifications\Enums\NotificationType;
use App\Modules\Notifications\Support\RetriesWithBackoff;
use App\Modules\OwnerFunds\Events\PayoutAccountChangeContested;
use Illuminate\Contracts\Queue\ShouldQueue;

final class NotifyAccountChangeContested implements ShouldQueue
{
    use RetriesWithBackoff;

    public function __construct(private readonly CreateNotifications $notifications) {}

    public function handle(PayoutAccountChangeContested $evenement): void
    {
        $this->notifications->handle(new NotificationInput(
            NotificationType::OwnerAccountChangeContested,
            $evenement->organizationId,
            "account:{$evenement->holdId}:contested",
            [],
            null,
            $evenement->holdId,
            $evenement->mandantPartyId,
        ));
        $this->notifications->handle(new NotificationInput(
            NotificationType::OwnerFundsAccountChangeContested,
            $evenement->organizationId,
            "account:{$evenement->holdId}:contested",
            [],
            null,
            $evenement->holdId,
            null,
        ));
    }
}
