<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Listeners;

use App\Modules\Messaging\Events\SupportAccessRequested;
use App\Modules\Notifications\Actions\CreateNotifications;
use App\Modules\Notifications\Data\NotificationInput;
use App\Modules\Notifications\Enums\NotificationType;
use App\Modules\Notifications\Support\RetriesWithBackoff;
use Illuminate\Contracts\Queue\ShouldQueue;

/**
 * Prévient `owner` et `admin` de l'organisation ; ni motif ni nom d'opérateur (ADR 0033, décision 7).
 */
final class NotifySupportAccessRequested implements ShouldQueue
{
    use RetriesWithBackoff;

    public function __construct(private readonly CreateNotifications $notifications) {}

    public function handle(SupportAccessRequested $e): void
    {
        $this->notifications->handle(new NotificationInput(
            NotificationType::SupportAccessRequested,
            $e->organizationId,
            "grant:{$e->grantId}:requested",
            subjectId: $e->grantId,
        ));
    }
}
