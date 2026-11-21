<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Listeners;

use App\Modules\Notifications\Actions\CreateNotifications;
use App\Modules\Notifications\Data\NotificationInput;
use App\Modules\Notifications\Enums\NotificationType;
use App\Modules\Notifications\Support\RetriesWithBackoff;
use App\Modules\Rent\Events\InstallmentOverdue;
use Illuminate\Contracts\Queue\ShouldQueue;

/**
 * Idempotent : la clé de dédoublonnage dérive de l'échéance (ADR 0027).
 */
final class NotifyInstallmentOverdue implements ShouldQueue
{
    use RetriesWithBackoff;

    public function __construct(private readonly CreateNotifications $notifications) {}

    public function handle(InstallmentOverdue $evenement): void
    {
        $this->notifications->handle(new NotificationInput(
            NotificationType::RentOverdue,
            $evenement->organizationId,
            "overdue:{$evenement->installmentId}",
            ['date' => $evenement->dueDate],
            $evenement->leaseId,
        ));
    }
}
