<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Listeners;

use App\Modules\Messaging\Events\SupportAccessEmergencyOpened;
use App\Modules\Notifications\Actions\CreateNotifications;
use App\Modules\Notifications\Data\NotificationInput;
use App\Modules\Notifications\Enums\NotificationType;
use App\Modules\Notifications\Support\RetriesWithBackoff;
use Illuminate\Contracts\Queue\ShouldQueue;

/**
 * Prévient `owner` et `admin` de l'organisation ; ni motif ni nom d'opérateur (ADR 0033, décision 7).
 */
final class NotifySupportAccessEmergency implements ShouldQueue
{
    use RetriesWithBackoff;

    public function __construct(private readonly CreateNotifications $notifications) {}

    public function handle(SupportAccessEmergencyOpened $e): void
    {
        $this->notifications->handle(new NotificationInput(
            NotificationType::SupportAccessEmergency,
            $e->organizationId,
            "grant:{$e->grantId}:emergency",
            subjectId: $e->grantId,
        ));
    }
}
