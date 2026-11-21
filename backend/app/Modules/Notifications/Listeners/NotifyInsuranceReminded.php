<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Listeners;

use App\Modules\Leases\Events\LeaseInsuranceReminded;
use App\Modules\Notifications\Actions\CreateNotifications;
use App\Modules\Notifications\Data\NotificationInput;
use App\Modules\Notifications\Enums\NotificationType;
use App\Modules\Notifications\Support\RetriesWithBackoff;
use Illuminate\Contracts\Queue\ShouldQueue;

final class NotifyInsuranceReminded implements ShouldQueue
{
    use RetriesWithBackoff;

    public function __construct(private readonly CreateNotifications $notifications) {}

    public function handle(LeaseInsuranceReminded $evenement): void
    {
        $this->notifications->handle(new NotificationInput(
            NotificationType::TenantInsuranceReminder,
            $evenement->organizationId,
            "insurance_reminder:{$evenement->leaseId}:{$evenement->date}",
            leaseId: $evenement->leaseId,
        ));
    }
}
