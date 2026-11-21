<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Listeners;

use App\Modules\Notifications\Actions\CreateNotifications;
use App\Modules\Notifications\Data\NotificationInput;
use App\Modules\Notifications\Enums\NotificationType;
use App\Modules\Notifications\Support\RetriesWithBackoff;
use App\Modules\Parties\Events\ContactUpdateRequested;
use Illuminate\Contracts\Queue\ShouldQueue;

final class NotifyContactUpdateRequested implements ShouldQueue
{
    use RetriesWithBackoff;

    public function __construct(private readonly CreateNotifications $notifications) {}

    public function handle(ContactUpdateRequested $evenement): void
    {
        $this->notifications->handle(new NotificationInput(
            NotificationType::PartiesContactUpdateRequested,
            $evenement->organizationId,
            "contact_update:{$evenement->requestId}",
            subjectId: $evenement->requestId,
        ));
    }
}
