<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Listeners;

use App\Modules\Charges\Events\ChargeRegularizationDue;
use App\Modules\Notifications\Actions\CreateNotifications;
use App\Modules\Notifications\Data\NotificationInput;
use App\Modules\Notifications\Enums\NotificationType;
use App\Modules\Notifications\Support\RetriesWithBackoff;
use Illuminate\Contracts\Queue\ShouldQueue;

/**
 * Idempotent : une seule alerte par bail et par exercice.
 */
final class NotifyChargeRegularizationDue implements ShouldQueue
{
    use RetriesWithBackoff;

    public function __construct(private readonly CreateNotifications $notifications) {}

    public function handle(ChargeRegularizationDue $evenement): void
    {
        $this->notifications->handle(new NotificationInput(
            NotificationType::ChargesRegularizationDue,
            $evenement->organizationId,
            "charges_due:{$evenement->leaseId}:{$evenement->year}",
            ['year' => (string) $evenement->year],
            $evenement->leaseId,
        ));
    }
}
