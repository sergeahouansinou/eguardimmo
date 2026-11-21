<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Listeners;

use App\Modules\Maintenance\Events\InterventionQualified;
use App\Modules\Notifications\Actions\CreateNotifications;
use App\Modules\Notifications\Data\NotificationInput;
use App\Modules\Notifications\Enums\NotificationType;
use App\Modules\Notifications\Support\RetriesWithBackoff;
use Illuminate\Contracts\Queue\ShouldQueue;

final class NotifyInterventionQualified implements ShouldQueue
{
    use RetriesWithBackoff;

    public function __construct(private readonly CreateNotifications $notifications) {}

    public function handle(InterventionQualified $evenement): void
    {
        $this->notifications->handle(new NotificationInput(
            NotificationType::TenantRequestQualified,
            $evenement->organizationId,
            "qualified:{$evenement->interventionId}",
            ['label' => $evenement->reference],
            $evenement->leaseId,
            $evenement->interventionId,
        ));
    }
}
