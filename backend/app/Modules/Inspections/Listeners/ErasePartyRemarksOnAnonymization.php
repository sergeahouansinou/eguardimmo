<?php

declare(strict_types=1);

namespace App\Modules\Inspections\Listeners;

use App\Modules\Inspections\Actions\ErasePartyRemarks;
use App\Modules\Parties\Events\PartyAnonymized;
use App\Shared\Tenancy\CurrentOrganization;
use Illuminate\Contracts\Queue\ShouldQueue;

/**
 * Idempotent : un second passage ne trouve plus rien à effacer.
 */
final class ErasePartyRemarksOnAnonymization implements ShouldQueue
{
    public int $tries = 5;

    public function __construct(
        private readonly ErasePartyRemarks $effacer,
        private readonly CurrentOrganization $organisation,
    ) {}

    /**
     * @return list<int>
     */
    public function backoff(): array
    {
        return [30, 120, 600, 1800];
    }

    public function handle(PartyAnonymized $evenement): void
    {
        $this->organisation->run($evenement->organizationId, fn (): int => $this->effacer->handle($evenement->partyId));
    }
}
