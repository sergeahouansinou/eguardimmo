<?php

declare(strict_types=1);

namespace App\Modules\Leases\Support;

use App\Modules\Leases\Data\NewLeasePartyData;
use App\Modules\Leases\Enums\LeasePartyRole;
use App\Modules\Leases\Queries\TenantCounts;
use App\Modules\Subscriptions\Enums\Feature;
use App\Modules\Subscriptions\PublicApi\Entitlements;
use App\Shared\Tenancy\CurrentOrganization;

/**
 * Plafond « locataires » (ADR 0013). À appeler dans la transaction de l'Action et avant tout verrou de bail : le verrou de
 * l'abonnement se prend toujours le premier.
 */
final readonly class TenantQuota
{
    public function __construct(private TenantCounts $comptes, private Entitlements $droits, private CurrentOrganization $organisation) {}

    /**
     * @param  list<NewLeasePartyData>  $parties  lignes de parties d'un brouillon : seules les lignes locataires comptent
     */
    public function assertRoomFor(array $parties, ?string $remplace = null): void
    {
        $this->assertRoom(array_values(array_map(
            fn (NewLeasePartyData $partie): string => $partie->partyId,
            array_filter($parties, fn (NewLeasePartyData $partie): bool => $partie->role === LeasePartyRole::Tenant),
        )), $remplace);
    }

    /**
     * Seules les personnes qui ne sont pas déjà comptées ajoutent au total. `$remplace` est un brouillon dont les lignes sont réécrites :
     * ses locataires actuels ne comptent pas, ceux de `$candidats` les remplacent.
     *
     * @param  list<string>  $candidats  personnes qui seront locataires du bail
     */
    public function assertRoom(array $candidats, ?string $remplace = null): void
    {
        $candidats = array_values(array_unique($candidats));

        if ($candidats === []) {
            return;
        }

        $etat = [];
        $lire = function () use (&$etat, $candidats, $remplace): array {
            if ($etat === []) {
                $actuel = $this->comptes->distinct();
                $autres = $remplace === null ? $actuel : $this->comptes->distinct($remplace);
                $deja = $this->comptes->among($candidats, $remplace);
                $etat = ['actuel' => $actuel, 'ajout' => $autres + count($candidats) - $deja - $actuel];
            }

            return $etat;
        };

        $this->droits->assertWithin($this->organisation->id(), Feature::Tenants, fn (): int => $lire()['actuel'], fn (): int => $lire()['ajout']);
    }
}
