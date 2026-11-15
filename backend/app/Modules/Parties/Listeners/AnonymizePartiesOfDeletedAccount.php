<?php

declare(strict_types=1);

namespace App\Modules\Parties\Listeners;

use App\Modules\Identity\Events\AccountDeleted;
use App\Modules\Parties\Actions\AnonymizeParty;
use App\Modules\Parties\Models\Party;
use App\Modules\Parties\Queries\PartiesOfUser;
use App\Shared\Tenancy\CurrentOrganization;
use Illuminate\Contracts\Queue\ShouldQueue;

final class AnonymizePartiesOfDeletedAccount implements ShouldQueue
{
    public int $tries = 5;

    public function __construct(
        private readonly PartiesOfUser $parties,
        private readonly CurrentOrganization $organisation,
        private readonly AnonymizeParty $anonymisation,
    ) {}

    /**
     * Idempotent : une partie déjà anonymisée n'est plus sélectionnée, et rejouer l'événement ne change rien.
     */
    public function handle(AccountDeleted $evenement): void
    {
        foreach ($this->parties->pending($evenement->userId) as $ligne) {
            $this->organisation->run($ligne['organization_id'], function () use ($ligne): void {
                $partie = Party::query()->find($ligne['party_id']);

                if ($partie !== null) {
                    $this->anonymisation->handle($partie, 'account_deleted');
                }
            });
        }
    }
}
