<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Listeners;

use App\Modules\Charges\Events\ChargeStatementIssued;
use App\Modules\Notifications\Actions\CreateNotifications;
use App\Modules\Notifications\Data\NotificationInput;
use App\Modules\Notifications\Enums\NotificationType;
use App\Modules\Notifications\Support\RetriesWithBackoff;
use Illuminate\Contracts\Queue\ShouldQueue;

/**
 * Idempotent : la clé de dédoublonnage dérive du décompte ; ni montant ni pièce dans le message (ADR 0034).
 */
final class NotifyChargeStatementIssued implements ShouldQueue
{
    use RetriesWithBackoff;

    public function __construct(private readonly CreateNotifications $notifications) {}

    public function handle(ChargeStatementIssued $evenement): void
    {
        $this->notifications->handle(new NotificationInput(
            NotificationType::TenantChargeStatementIssued,
            $evenement->organizationId,
            "charge_statement:{$evenement->statementId}",
            [],
            $evenement->leaseId,
            $evenement->statementId,
        ));
    }
}
