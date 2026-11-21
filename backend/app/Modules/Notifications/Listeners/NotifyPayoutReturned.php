<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Listeners;

use App\Modules\Notifications\Actions\CreateNotifications;
use App\Modules\Notifications\Data\NotificationInput;
use App\Modules\Notifications\Enums\NotificationType;
use App\Modules\Notifications\Support\RetriesWithBackoff;
use App\Modules\OwnerFunds\Events\PayoutReturned;
use Illuminate\Contracts\Queue\ShouldQueue;

final class NotifyPayoutReturned implements ShouldQueue
{
    use RetriesWithBackoff;

    public function __construct(private readonly CreateNotifications $notifications) {}

    public function handle(PayoutReturned $evenement): void
    {
        $this->notifications->handle(new NotificationInput(
            NotificationType::OwnerFundsPayoutReturned,
            $evenement->organizationId,
            "ownerfunds:payout:{$evenement->itemId}:returned",
            ['label' => $evenement->batchNumber],
            null,
            $evenement->itemId,
        ));
        $this->notifications->handle(new NotificationInput(
            NotificationType::OwnerPayoutReturned,
            $evenement->organizationId,
            "payout:{$evenement->itemId}:returned",
            [],
            null,
            $evenement->itemId,
            $evenement->mandantPartyId,
        ));
    }
}
