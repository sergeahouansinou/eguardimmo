<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Listeners;

use App\Modules\Mandates\Events\MandateEndRequested;
use App\Modules\Notifications\Actions\CreateNotifications;
use App\Modules\Notifications\Data\NotificationInput;
use App\Modules\Notifications\Enums\NotificationType;
use App\Modules\Notifications\Support\RetriesWithBackoff;
use Illuminate\Contracts\Queue\ShouldQueue;

final class NotifyMandateEndRequested implements ShouldQueue
{
    use RetriesWithBackoff;

    public function __construct(private readonly CreateNotifications $notifications) {}

    public function handle(MandateEndRequested $evenement): void
    {
        $this->notifications->handle(new NotificationInput(
            NotificationType::MandatesEndRequested,
            $evenement->organizationId,
            "mandate-end:{$evenement->requestId}:requested",
            ['label' => $evenement->reference],
            null,
            $evenement->mandateId,
        ));
    }
}
