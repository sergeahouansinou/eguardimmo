<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Listeners;

use App\Modules\Notifications\Actions\CreateNotifications;
use App\Modules\Notifications\Data\NotificationInput;
use App\Modules\Notifications\Enums\NotificationType;
use App\Modules\Notifications\Support\RetriesWithBackoff;
use App\Modules\Organizations\Events\OrganizationReactivated;
use Illuminate\Contracts\Queue\ShouldQueue;

/**
 * Prévient `owner` et `admin` ; ni motif ni nom d'opérateur.
 */
final class NotifyOrganizationReactivated implements ShouldQueue
{
    use RetriesWithBackoff;

    public function __construct(private readonly CreateNotifications $notifications) {}

    public function handle(OrganizationReactivated $e): void
    {
        $this->notifications->handle(new NotificationInput(
            NotificationType::OrganizationReactivated,
            $e->organizationId,
            "approval:{$e->approvalId}:reactivated",
            subjectId: $e->organizationId,
        ));
    }
}
