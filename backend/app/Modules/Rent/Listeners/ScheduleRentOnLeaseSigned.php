<?php

declare(strict_types=1);

namespace App\Modules\Rent\Listeners;

use App\Modules\Leases\Events\LeaseSigned;
use App\Modules\Leases\PublicApi\LeaseSchedule;
use App\Modules\Rent\Actions\GenerateInstallments;
use App\Shared\Tenancy\CurrentOrganization;
use Carbon\CarbonImmutable;
use Illuminate\Contracts\Queue\ShouldQueue;

final class ScheduleRentOnLeaseSigned implements ShouldQueue
{
    public int $tries = 5;

    public function __construct(
        private readonly CurrentOrganization $contexte,
        private readonly LeaseSchedule $baux,
        private readonly GenerateInstallments $generation,
    ) {}

    /**
     * Idempotent : l'échéancier et les échéances ont une clé unique, rejouer l'événement ne crée rien. La tâche
     * `rent:generate` rattrape un événement perdu (ADR 0007).
     */
    public function handle(LeaseSigned $evenement): void
    {
        $this->contexte->run($evenement->organizationId, function () use ($evenement): void {
            $this->generation->handle($this->baux->billing($evenement->leaseId), CarbonImmutable::today());
        });
    }
}
