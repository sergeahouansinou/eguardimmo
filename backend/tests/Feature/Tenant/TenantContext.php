<?php

declare(strict_types=1);

namespace Tests\Feature\Tenant;

use App\Modules\Identity\Models\User;
use App\Modules\Leases\Enums\LeasePartyRole;
use App\Modules\Leases\Models\Lease;
use App\Modules\Leases\Models\LeaseParty;
use App\Modules\Organizations\Actions\CreateOrganization;
use App\Modules\Organizations\Data\NewOrganizationData;
use App\Modules\Organizations\Enums\OrganizationKind;
use App\Modules\Organizations\Models\Organization;
use App\Modules\Parties\Actions\AddContactPoint;
use App\Modules\Parties\Enums\ContactPointType;
use App\Modules\Parties\Models\ContactPoint;
use App\Modules\Parties\Models\Party;
use App\Shared\Tenancy\CurrentOrganization;
use Tests\Feature\Leases\LeasesContext as L;
use Tests\Feature\Leases\LeasesReadContext as R;

final class TenantContext
{
    public const string AUJOURDHUI = '2026-11-16 10:00:00';

    public static function organisation(string $nom = 'Agence du Port'): Organization
    {
        $titulaire = User::factory()->create();
        activerDeuxFacteurs($titulaire);

        return app(CreateOrganization::class)->handle($titulaire, new NewOrganizationData(OrganizationKind::Agency, $nom, 'FR'), 'Awa', 'Diallo');
    }

    public static function comme(mixed $test, ?User $compte): mixed
    {
        auth()->forgetGuards();
        app()->forgetInstance(CurrentOrganization::class);
        app()->forgetScopedInstances();

        return $compte === null ? $test : $test->actingAs($compte);
    }

    /**
     * Un compte rattaché à une partie de l'organisation, locataire d'un bail signé avec un lot principal et un loyer.
     *
     * @param  array<string, mixed>  $bail
     * @param  array<string, mixed>  $ligne
     * @return array{user: User, party: Party, lease: Lease, line: LeaseParty}
     */
    public static function locataire(Organization $organisation, array $bail = [], array $ligne = [], ?User $compte = null): array
    {
        $compte ??= User::factory()->create();
        $partie = L::dans($organisation, fn (): Party => Party::query()->where('user_id', $compte->id)->first() ?? Party::factory()->create(['user_id' => $compte->id]));
        $contrat = R::bailSigne($organisation, ['starts_on' => '2026-01-01', 'ends_on' => '2029-01-01', ...$bail]);
        R::occuper($organisation, $contrat, L::lot($organisation), ['valid_from' => '2026-01-01', 'is_main' => true]);
        R::terme($organisation, $contrat, 'rent', [...R::loyer(65000), 'valid_from' => '2026-01-01']);

        return [
            'user' => $compte,
            'party' => $partie,
            'lease' => $contrat,
            'line' => R::lier($organisation, $contrat, $partie, ['valid_from' => '2026-01-01', ...$ligne]),
        ];
    }

    /**
     * @param  array<string, mixed>  $attributs
     */
    public static function partie(Organization $organisation, array $attributs = []): Party
    {
        return L::dans($organisation, fn (): Party => Party::factory()->create($attributs));
    }

    public static function emailPrincipal(Organization $organisation, Party $partie, string $email): void
    {
        L::dans($organisation, fn (): ContactPoint => app(AddContactPoint::class)->handle($partie, ContactPointType::Email, $email, null, true));
    }

    /**
     * @param  array<string, mixed>  $attributs
     */
    public static function colocataire(Organization $organisation, Lease $bail, array $attributs = [], LeasePartyRole $role = LeasePartyRole::Tenant): Party
    {
        $partie = self::partie($organisation);
        R::lier($organisation, $bail, $partie, ['role' => $role, 'valid_from' => '2026-01-01', ...$attributs]);

        return $partie;
    }
}
