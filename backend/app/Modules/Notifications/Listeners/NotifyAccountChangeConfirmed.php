<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Listeners;

use App\Modules\Notifications\Actions\CreateNotifications;
use App\Modules\Notifications\Data\NotificationInput;
use App\Modules\Notifications\Enums\NotificationType;
use App\Modules\Notifications\Support\RetriesWithBackoff;
use App\Modules\OwnerFunds\Events\PayoutAccountChangeConfirmed;
use Illuminate\Contracts\Queue\ShouldQueue;

final class NotifyAccountChangeConfirmed implements ShouldQueue
{
    use RetriesWithBackoff;

    public function __construct(private readonly CreateNotifications $notifications) {}

    public function handle(PayoutAccountChangeConfirmed $evenement): void
    {
        $this->notifications->handle(new NotificationInput(
            NotificationType::OwnerFundsAccountChangeRequested,
            $evenement->organizationId,
            "account:{$evenement->requestId}:confirmed",
            [],
            null,
            $evenement->requestId,
            null,
        ));
    }
}
