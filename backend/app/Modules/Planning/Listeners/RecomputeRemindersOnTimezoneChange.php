<?php

declare(strict_types=1);

namespace App\Modules\Planning\Listeners;

use App\Modules\Organizations\Events\OrganizationTimezoneChanged;
use App\Modules\Planning\Actions\RecomputeReminders;
use App\Shared\Tenancy\CurrentOrganization;
use Illuminate\Contracts\Queue\ShouldQueue;

final class RecomputeRemindersOnTimezoneChange implements ShouldQueue
{
    public int $tries = 5;

    public function __construct(
        private readonly CurrentOrganization $contexte,
        private readonly RecomputeReminders $recalcul,
    ) {}

    public function handle(OrganizationTimezoneChanged $evenement): void
    {
        $this->contexte->run($evenement->organizationId, fn (): array => $this->recalcul->handle($evenement->timezone));
    }
}
