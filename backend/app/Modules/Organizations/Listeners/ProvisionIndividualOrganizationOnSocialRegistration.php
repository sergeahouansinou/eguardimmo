<?php

declare(strict_types=1);

namespace App\Modules\Organizations\Listeners;

use App\Modules\Identity\Events\UserRegistered;
use App\Modules\Identity\Models\User;
use App\Modules\Organizations\Actions\ProvisionIndividualOrganization;

final readonly class ProvisionIndividualOrganizationOnSocialRegistration
{
    public function __construct(private ProvisionIndividualOrganization $provisionner) {}

    public function handle(UserRegistered $evenement): void
    {
        $user = User::query()->find($evenement->userId);

        // Inscription par e-mail : le compte n'est pas vérifié, l'organisation naît à l'événement Verified.
        if ($user === null || $user->email_verified_at === null) {
            return;
        }

        $this->provisionner->handle($user, 'social_registration');
    }
}
