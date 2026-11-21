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
 * Réémis par le balayage quotidien pendant sept jours : la clé (pièce, état, échéance) dédoublonne.
 */
final class NotifyCertificateDeadline implements ShouldQueue
{
    use RetriesWithBackoff;

    public function __construct(private readonly CreateNotifications $notifications) {}

    public function handle(CertificateDeadlineReached $evenement): void
    {
        if ($evenement->subjectType === 'lease') {
            return;
        }

        $type = $evenement->state === CertificateState::Expired ? NotificationType::CertificateExpired : NotificationType::CertificateToRenew;

        $this->notifications->handle(new NotificationInput(
            $type,
            $evenement->organizationId,
            "certificate:{$evenement->certificateId}:{$evenement->state->value}:{$evenement->expiresOn}",
            ['date' => $evenement->expiresOn, 'label' => $evenement->typeLabel],
            subjectId: $evenement->certificateId,
        ));
    }
}
