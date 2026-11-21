<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Listeners;

use App\Modules\Notifications\Actions\CreateNotifications;
use App\Modules\Notifications\Data\NotificationInput;
use App\Modules\Notifications\Enums\NotificationType;
use App\Modules\Notifications\Support\RetriesWithBackoff;
use App\Modules\Recovery\Events\RecoveryBundleSent;
use Illuminate\Contracts\Queue\ShouldBeEncrypted;
use Illuminate\Contracts\Queue\ShouldQueue;

/**
 * L'événement porte le jeton de transmission en clair : écouteur chiffré en file, jamais copié dans une notification.
 */
final class NotifyBundleSent implements ShouldBeEncrypted, ShouldQueue
{
    use RetriesWithBackoff;

    public function __construct(private readonly CreateNotifications $notifications) {}

    public function handle(RecoveryBundleSent $evenement): void
    {
        $this->notifications->handle(new NotificationInput(
            NotificationType::RecoveryBundleSent,
            $evenement->organizationId,
            "bundle_sent:{$evenement->transmissionId}",
        ));
    }
}
