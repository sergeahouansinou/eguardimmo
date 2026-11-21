<?php

declare(strict_types=1);

namespace App\Modules\Parties\PublicApi;

use App\Modules\Identity\Enums\OwnerAccessRole;
use App\Modules\Parties\Data\OwnerLinkData;
use App\Modules\Parties\Queries\OwnerAccesses;

/**
 * Accès d'un compte à des mandants (ADR 0032) : la clé de lecture de l'espace propriétaire, hors contexte d'organisation.
 * Parties ne connaît pas les mandats : la fenêtre d'accès est calculée par `MandateDirectory::visibleToOwner()`.
 */
final readonly class OwnerLinks
{
    public function __construct(private OwnerAccesses $acces) {}

    /**
     * Accès vivants du compte sur des mandants non anonymisés, toutes organisations confondues.
     *
     * @return list<OwnerLinkData>
     */
    public function activeFor(string $userId): array
    {
        return $this->acces->activeOf($userId);
    }

    /**
     * Comptes ayant un accès vivant sur le mandant de l'organisation courante, pour les rôles donnés : les destinataires des
     * notifications du mandant. La fenêtre d'accès se juge à la lecture, pas ici.
     *
     * @param  list<OwnerAccessRole>  $roles
     * @return list<string>
     */
    public function accountsOfMandant(string $mandantPartyId, array $roles): array
    {
        return $this->acces->accountsOfMandant($mandantPartyId, $roles);
    }

    /**
     * Même lecture pour plusieurs mandants en une requête.
     *
     * @param  list<string>  $mandantPartyIds
     * @param  list<OwnerAccessRole>  $roles
     * @return array<string, list<string>> comptes par mandant
     */
    public function accountsOfMandants(array $mandantPartyIds, array $roles): array
    {
        return $this->acces->accountsOfMandants($mandantPartyIds, $roles);
    }
}
