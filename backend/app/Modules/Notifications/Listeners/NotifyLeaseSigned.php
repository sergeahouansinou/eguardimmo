<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Listeners;

use App\Modules\Leases\Events\LeaseSigned;
use App\Modules\Notifications\Actions\CreateNotifications;
use App\Modules\Notifications\Data\NotificationInput;
use App\Modules\Notifications\Enums\NotificationType;
use App\Modules\Notifications\Support\RetriesWithBackoff;
use Illuminate\Contracts\Queue\ShouldQueue;

final class NotifyLeaseSigned implements ShouldQueue
{
    use RetriesWithBackoff;

    public function __construct(private readonly CreateNotifications $notifications) {}

    public function handle(LeaseSigned $evenement): void
    {
        foreach ([NotificationType::LeaseSigned, NotificationType::TenantLeaseSigned] as $type) {
            $this->notifications->handle(new NotificationInput(
                $type,
                $evenement->organizationId,
                "lease_signed:{$evenement->leaseId}",
                [],
                $evenement->leaseId,
            ));
        }
    }
}
