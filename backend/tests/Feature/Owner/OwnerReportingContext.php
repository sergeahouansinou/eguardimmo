<?php

declare(strict_types=1);

namespace Tests\Feature\Owner;

use App\Modules\Identity\Enums\OwnerAccessRole;
use App\Modules\Identity\Models\User;
use App\Modules\Organizations\Models\Organization;
use App\Modules\Parties\Models\Party;
use Tests\Feature\Leases\LeasesContext as L;
use Tests\Feature\Mandates\MandatesContext as M;
use Tests\Feature\Owner\OwnerContext as O;

final class OwnerReportingContext
{
    /**
     * Compte propriétaire rattaché au mandant d'une agence dont le grand livre est réel.
     */
    public static function rattacher(Organization $org, Party $mandant, string $email = 'awa@exemple.fr', OwnerAccessRole $role = OwnerAccessRole::Holder): User
    {
        $compte = User::factory()->create(['email' => $email]);
        O::acces($org, $mandant, $compte, $role);

        return $compte;
    }

    public static function agence(object $test, Organization $org): void
    {
        M::basculer($test, L::titulaire($org));
    }
}
