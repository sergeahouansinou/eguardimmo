<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Listeners;

use App\Modules\Leases\Events\LeaseInsuranceDecided;
use App\Modules\Notifications\Actions\CreateNotifications;
use App\Modules\Notifications\Data\NotificationInput;
use App\Modules\Notifications\Enums\NotificationType;
use App\Modules\Notifications\Support\RetriesWithBackoff;
use Illuminate\Contracts\Queue\ShouldQueue;

/**
 * Le motif d'un refus reste dans l'écran : jamais dans le texte de la notification.
 */
final class NotifyInsuranceDecided implements ShouldQueue
{
    use RetriesWithBackoff;

    public function __construct(private readonly CreateNotifications $notifications) {}

    public function handle(LeaseInsuranceDecided $evenement): void
    {
        $etat = $evenement->accepted ? 'accepted' : 'rejected';

        $this->notifications->handle(new NotificationInput(
            $evenement->accepted ? NotificationType::TenantInsuranceAccepted : NotificationType::TenantInsuranceRejected,
            $evenement->organizationId,
            "insurance:{$evenement->submissionId}:{$etat}",
            leaseId: $evenement->leaseId,
            subjectId: $evenement->submissionId,
            partyId: $evenement->partyId,
        ));
    }
}
