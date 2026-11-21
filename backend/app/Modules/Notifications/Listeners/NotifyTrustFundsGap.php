<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Listeners;

use App\Modules\Notifications\Actions\CreateNotifications;
use App\Modules\Notifications\Data\NotificationInput;
use App\Modules\Notifications\Enums\NotificationType;
use App\Modules\Notifications\Support\RetriesWithBackoff;
use App\Modules\OwnerFunds\Events\TrustFundsGapDetected;
use Illuminate\Contracts\Queue\ShouldQueue;

final class NotifyTrustFundsGap implements ShouldQueue
{
    use RetriesWithBackoff;

    public function __construct(private readonly CreateNotifications $notifications) {}

    public function handle(TrustFundsGapDetected $evenement): void
    {
        $this->notifications->handle(new NotificationInput(
            NotificationType::OwnerFundsTrustGap,
            $evenement->organizationId,
            "ownerfunds:trust_gap:{$evenement->day}",
            [],
            null,
            null,
        ));
    }
}
