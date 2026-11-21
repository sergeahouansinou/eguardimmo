<?php

declare(strict_types=1);

namespace App\Modules\Subscriptions\Listeners;

use App\Modules\Organizations\Events\OrganizationCreated;
use App\Modules\Subscriptions\Actions\StartTrial;
use Illuminate\Contracts\Queue\ShouldQueue;

final class StartTrialOnOrganizationCreated implements ShouldQueue
{
    public int $tries = 5;

    public function __construct(private readonly StartTrial $essai) {}

    public function handle(OrganizationCreated $evenement): void
    {
        $this->essai->handle($evenement->organizationId);
    }
}
