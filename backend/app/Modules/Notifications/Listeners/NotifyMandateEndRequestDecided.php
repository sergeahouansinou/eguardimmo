<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Listeners;

use App\Modules\Mandates\Enums\EndRequestStatus;
use App\Modules\Mandates\Events\MandateEndRequestDecided;
use App\Modules\Notifications\Actions\CreateNotifications;
use App\Modules\Notifications\Data\NotificationInput;
use App\Modules\Notifications\Enums\NotificationType;
use App\Modules\Notifications\Support\RetriesWithBackoff;
use Illuminate\Contracts\Queue\ShouldQueue;

final class NotifyMandateEndRequestDecided implements ShouldQueue
{
    use RetriesWithBackoff;

    public function __construct(private readonly CreateNotifications $notifications) {}

    public function handle(MandateEndRequestDecided $evenement): void
    {
        $this->notifications->handle(new NotificationInput(
            $evenement->decision === EndRequestStatus::Fulfilled ? NotificationType::OwnerMandateEndFulfilled : NotificationType::OwnerMandateEndDismissed,
            $evenement->organizationId,
            "mandate-end:{$evenement->requestId}:{$evenement->decision->value}",
            ['label' => $evenement->reference],
            null,
            $evenement->mandateId,
            partyId: $evenement->mandantPartyId,
        ));
    }
}
