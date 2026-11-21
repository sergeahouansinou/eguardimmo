<?php

declare(strict_types=1);

namespace App\Modules\Organizations\Queries;

use App\Modules\Identity\Models\User;
use App\Modules\Organizations\Models\OrganizationMember;

final readonly class MemberAddresses
{
    /**
     * Membres de l'organisation courante, quel que soit leur statut (actif, invité, désactivé) : l'adresse de l'adhésion
     * comme celle, actuelle, du compte rattaché.
     */
    public function has(string $email): bool
    {
        $adresse = mb_strtolower(trim($email));

        return OrganizationMember::query()
            ->where(fn ($q) => $q->whereRaw('lower(email) = ?', [$adresse])
                ->orWhereIn('user_id', User::query()->whereRaw('lower(email) = ?', [$adresse])->select('id')))
            ->exists();
    }
}
