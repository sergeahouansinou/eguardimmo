<?php

declare(strict_types=1);

namespace App\Modules\Parties\PublicApi;

use App\Modules\Parties\Data\LinkedPartyData;
use App\Modules\Parties\Queries\PartiesOfUser;

/**
 * Parties rattachées à un compte (ADR 0024) : sert de clé de lecture à l'espace locataire, hors contexte d'organisation.
 */
final readonly class PartyLinks
{
    public function __construct(private PartiesOfUser $parties) {}

    /**
     * Parties non anonymisées rattachées au compte, toutes organisations confondues ; une seule par organisation.
     *
     * @return list<LinkedPartyData>
     */
    public function linkedTo(string $userId): array
    {
        return array_map(
            fn (array $ligne): LinkedPartyData => new LinkedPartyData($ligne['organization_id'], $ligne['party_id']),
            $this->parties->pending($userId),
        );
    }

    /**
     * Comptes rattachés à ces parties ; suppose un contexte d'organisation.
     *
     * @param  list<string>  $partyIds
     * @return array<string, string> identifiant du compte par identifiant de partie
     */
    public function accountsOf(array $partyIds): array
    {
        return $this->parties->accounts($partyIds);
    }
}
