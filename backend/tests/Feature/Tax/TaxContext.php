<?php

declare(strict_types=1);

namespace Tests\Feature\Tax;

use App\Modules\Identity\Models\User;
use App\Modules\Leases\Models\Lease;
use App\Modules\Organizations\Enums\MemberRole;
use App\Modules\Organizations\Enums\OrganizationKind;
use App\Modules\Organizations\Models\Organization;
use App\Modules\Parties\Models\Party;
use App\Modules\Properties\Models\Unit;
use App\Shared\Tenancy\CurrentOrganization;
use Carbon\CarbonImmutable;
use Illuminate\Testing\TestResponse;
use Tests\Feature\Charges\ChargesContext as Ch;
use Tests\Feature\Leases\LeasesContext as L;
use Tests\Feature\Rent\RentContext as C;

final class TaxContext
{
    public static function preparer(object $test): void
    {
        C::preparer($test);
        config(['tax.gotenberg.url' => 'http://gotenberg.test', 'tax.gotenberg.timeout' => 10, 'charges.gotenberg.url' => 'http://gotenberg.test', 'charges.gotenberg.timeout' => 10]);
    }

    /**
     * Bailleur autonome : un bien, un lot, un bail nu de 650,00 € + 50,00 € de provision (début 2025-01-01), échéance de mars 2025 appelée
     * et payée à hauteur de 300,00 €.
     *
     * @return array{org: Organization, owner: User, unit: Unit, property: string, lease: Lease, tenantParty: Party}
     */
    public static function bailleur2025(object $test, string $nom = 'Mme Martin'): array
    {
        $org = C::organisation(OrganizationKind::Individual, $nom);
        $test->travelTo(CarbonImmutable::parse('2025-03-05 10:00:00'));
        ['bail' => $bail, 'lot' => $lot, 'locataire' => $locataire] = C::bail($org, ['starts_on' => '2025-01-01', 'ends_on' => '2028-01-01', 'signed_on' => '2024-12-15']);
        $titulaire = L::titulaire($org);
        C::emises($org, $bail, $test, '2025-03-05 10:00:00');
        $test->travelTo(CarbonImmutable::parse('2025-03-10 10:00:00'));
        C::payer($test, $org, $bail, 30000, ['received_on' => '2025-03-10'])->assertCreated();
        $test->travelTo(CarbonImmutable::parse('2025-04-01 10:00:00'));

        return ['org' => $org, 'owner' => $titulaire, 'unit' => $lot, 'property' => $lot->property_id, 'lease' => $bail, 'tenantParty' => $locataire];
    }

    /**
     * @param  array<string, mixed>  $scene
     * @param  array<string, mixed>  $corps
     */
    public static function depense(object $test, array $scene, string $categorie, int $montant, array $corps = []): TestResponse
    {
        return Ch::depense($test, $scene, [
            'category_term_id' => Ch::categorie($categorie),
            'total_gross' => $montant,
            'tax_amount' => 0,
            'recoverable_amount' => 0,
            'recoverable_rubric' => null,
            'document_on' => '2025-03-10',
            'service_from' => '2025-01-01',
            'service_to' => '2026-01-01',
            'paid_on' => '2025-03-12',
            ...$corps,
        ]);
    }

    public static function comme(object $test, User $compte): object
    {
        auth()->forgetGuards();
        app()->forgetInstance(CurrentOrganization::class);

        return $test->actingAs($compte);
    }

    public static function membre(Organization $org, MemberRole $role): User
    {
        return L::membre($org, $role);
    }

    public static function url(Organization $org, string $chemin = ''): string
    {
        return "/api/v1/org/{$org->id}/tax{$chemin}";
    }
}
