<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Listeners;

use App\Modules\Notifications\Actions\CreateNotifications;
use App\Modules\Notifications\Data\NotificationInput;
use App\Modules\Notifications\Enums\NotificationType;
use App\Modules\Notifications\Support\RetriesWithBackoff;
use App\Modules\OwnerFunds\Events\PayoutFailed;
use Illuminate\Contracts\Queue\ShouldQueue;

final class NotifyPayoutFailed implements ShouldQueue
{
    use RetriesWithBackoff;

    public function __construct(private readonly CreateNotifications $notifications) {}

    public function handle(PayoutFailed $evenement): void
    {
        $this->notifications->handle(new NotificationInput(
            NotificationType::OwnerFundsPayoutFailed,
            $evenement->organizationId,
            "ownerfunds:payout:{$evenement->itemId}:failed",
            ['label' => $evenement->batchNumber],
            null,
            $evenement->itemId,
        ));
    }
}
