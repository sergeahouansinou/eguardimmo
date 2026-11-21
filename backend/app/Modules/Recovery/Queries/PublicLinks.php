<?php

declare(strict_types=1);

namespace App\Modules\Recovery\Queries;

use App\Modules\Recovery\Models\RecoveryTransmission;
use App\Shared\Tenancy\AcrossOrganizations;

final readonly class PublicLinks
{
    /**
     * Seule lecture sans contexte d'organisation du module : le jeton, par son empreinte, désigne la transmission et donc l'organisation.
     * La comparaison finale est à temps constant ; une ligne dont l'empreinte diffère est ignorée.
     */
    public function byTokenHash(string $hash): ?RecoveryTransmission
    {
        $transmission = AcrossOrganizations::query(RecoveryTransmission::class)->where('token_hash', $hash)->first();

        return $transmission !== null && hash_equals($transmission->token_hash, $hash) ? $transmission : null;
    }
}
