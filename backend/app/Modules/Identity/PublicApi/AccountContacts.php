<?php

declare(strict_types=1);

namespace App\Modules\Identity\PublicApi;

use App\Modules\Identity\Data\AccountContactData;
use App\Modules\Identity\Queries\AccountContactLookup;

/**
 * Nom et adresse d'un compte actif, pour traiter une demande qui le concerne ; un compte supprimé n'a plus de coordonnées.
 */
final readonly class AccountContacts
{
    public function __construct(private AccountContactLookup $annuaire) {}

    public function idByEmail(string $email): ?string
    {
        return $this->annuaire->idByEmail($email);
    }

    /**
     * @param  list<string>  $userIds
     * @return array<string, AccountContactData> par identifiant de compte
     */
    public function contacts(array $userIds): array
    {
        return $this->annuaire->contacts($userIds);
    }
}
