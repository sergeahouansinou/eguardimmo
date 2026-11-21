<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Listeners;

use App\Modules\Documents\Enums\CertificateState;
use App\Modules\Documents\Events\CertificateDeadlineReached;
use App\Modules\Notifications\Actions\CreateNotifications;
use App\Modules\Notifications\Data\NotificationInput;
use App\Modules\Notifications\Enums\NotificationType;
use App\Modules\Notifications\Support\RetriesWithBackoff;
use Illuminate\Contracts\Queue\ShouldQueue;

/**
 * Pièce rattachée à un bail (assurance habitation) : ce sont les locataires du bail qui sont prévenus, pas l'équipe
 * (voir NotifyCertificateDeadline). Même balayage quotidien, même clé de dédoublonnage.
 */
final class NotifyInsuranceDeadline implements ShouldQueue
{
    use RetriesWithBackoff;

    public function __construct(private readonly CreateNotifications $notifications) {}

    public function handle(CertificateDeadlineReached $evenement): void
    {
        if ($evenement->subjectType !== 'lease' || $evenement->subjectId === null) {
            return;
        }

        $this->notifications->handle(new NotificationInput(
            $evenement->state === CertificateState::Expired ? NotificationType::TenantInsuranceExpired : NotificationType::TenantInsuranceExpiring,
            $evenement->organizationId,
            "certificate:{$evenement->certificateId}:{$evenement->state->value}:{$evenement->expiresOn}",
            ['date' => $evenement->expiresOn],
            $evenement->subjectId,
            $evenement->certificateId,
        ));
    }
}
