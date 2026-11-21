<?php

declare(strict_types=1);

namespace App\Modules\Organizations\PublicApi;

use App\Modules\Organizations\Data\LegalIdentityData;
use App\Modules\Organizations\Queries\LegalIdentities;
use App\Modules\Organizations\Queries\MemberAddresses;
use App\Modules\Organizations\Queries\OrganizationNames;
use App\Modules\Organizations\Support\OrganizationCurrency;
use Money\Currency;

/**
 * `names()` : nom des organisations pour les espaces qui lisent hors de leur contexte (locataire, propriétaire), aucun
 * autre champ. `legalIdentity()` : identité légale du siège de l'organisation courante.
 */
final readonly class OrganizationDirectory
{
    public function __construct(
        private OrganizationNames $noms,
        private LegalIdentities $identites,
        private MemberAddresses $adresses,
    ) {}

    /**
     * @param  list<string>  $ids
     * @return array<string, string> nom par identifiant ; les identifiants inconnus sont absents
     */
    public function names(array $ids): array
    {
        return $this->noms->of($ids);
    }

    /**
     * Suppose un contexte d'organisation ; null tant que le siège n'a pas renseigné son identité légale.
     */
    public function legalIdentity(): ?LegalIdentityData
    {
        return $this->identites->data();
    }

    /**
     * Suppose un contexte d'organisation. Vrai si l'adresse est celle d'un membre de l'organisation, quel que soit son statut.
     */
    public function hasMemberAddress(string $email): bool
    {
        return $this->adresses->has($email);
    }

    /**
     * Pays du siège de l'organisation courante : il fixe la juridiction de facturation.
     */
    public function country(): string
    {
        return $this->identites->country();
    }

    /**
     * Fuseau IANA de l'organisation courante : il date les agendas, les échéances de tâches et les rappels.
     */
    public function timezone(): string
    {
        return $this->identites->timezone();
    }

    /**
     * Devise du siège de l'organisation courante.
     */
    public function currency(): Currency
    {
        return OrganizationCurrency::of($this->identites->country());
    }
}
