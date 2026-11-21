<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Listeners;

use App\Modules\Notifications\Actions\CreateNotifications;
use App\Modules\Notifications\Data\NotificationInput;
use App\Modules\Notifications\Enums\NotificationType;
use App\Modules\Notifications\Support\RetriesWithBackoff;
use App\Modules\Privacy\Events\PrivacyRequestForwarded;
use Illuminate\Contracts\Queue\ShouldQueue;

/**
 * Prévient `owner` et `admin` de l'organisation ; ni nom ni adresse du demandeur dans la notification.
 */
final class NotifyPrivacyRequestForwarded implements ShouldQueue
{
    use RetriesWithBackoff;

    public function __construct(private readonly CreateNotifications $notifications) {}

    public function handle(PrivacyRequestForwarded $e): void
    {
        $this->notifications->handle(new NotificationInput(
            NotificationType::PrivacyRequestForwarded,
            $e->organizationId,
            "privacy_forward:{$e->forwardId}",
            subjectId: $e->forwardId,
        ));
    }
}
