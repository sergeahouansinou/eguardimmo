<?php

declare(strict_types=1);

namespace App\Modules\Organizations\Listeners;

use App\Modules\Identity\Models\User;
use App\Modules\Organizations\Actions\ProvisionIndividualOrganization;
use Illuminate\Auth\Events\Verified;

final readonly class ProvisionIndividualOrganizationOnEmailVerified
{
    public function __construct(private ProvisionIndividualOrganization $provisionner) {}

    public function handle(Verified $evenement): void
    {
        if ($evenement->user instanceof User) {
            $this->provisionner->handle($evenement->user);
        }
    }
}
