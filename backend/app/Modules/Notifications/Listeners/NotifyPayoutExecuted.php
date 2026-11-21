<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Listeners;

use App\Modules\Notifications\Actions\CreateNotifications;
use App\Modules\Notifications\Data\NotificationInput;
use App\Modules\Notifications\Enums\NotificationType;
use App\Modules\Notifications\Support\RetriesWithBackoff;
use App\Modules\OwnerFunds\Events\PayoutExecuted;
use Illuminate\Contracts\Queue\ShouldQueue;

final class NotifyPayoutExecuted implements ShouldQueue
{
    use RetriesWithBackoff;

    public function __construct(private readonly CreateNotifications $notifications) {}

    public function handle(PayoutExecuted $evenement): void
    {
        $this->notifications->handle(new NotificationInput(
            NotificationType::OwnerFundsPayoutExecuted,
            $evenement->organizationId,
            "ownerfunds:payout:{$evenement->itemId}:executed",
            ['label' => $evenement->batchNumber],
            null,
            $evenement->itemId,
        ));
        $this->notifications->handle(new NotificationInput(
            NotificationType::OwnerPayoutExecuted,
            $evenement->organizationId,
            "payout:{$evenement->itemId}:executed",
            [],
            null,
            $evenement->itemId,
            $evenement->mandantPartyId,
        ));
    }
}
