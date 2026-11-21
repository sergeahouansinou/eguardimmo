<?php

declare(strict_types=1);

namespace Tests\Feature\Investments;

use App\Modules\Identity\Models\User;
use App\Modules\Organizations\Enums\MemberRole;
use App\Modules\Organizations\Enums\OrganizationKind;
use App\Modules\Organizations\Models\Organization;
use App\Modules\Properties\Models\Unit;
use App\Shared\Tenancy\CurrentOrganization;
use Illuminate\Http\UploadedFile;
use Illuminate\Testing\TestResponse;
use Tests\Feature\Documents\DocumentsContext;
use Tests\Feature\Leases\LeasesContext as L;
use Tests\Feature\Rent\RentContext as C;

final class InvestmentsContext
{
    public static function preparer(object $test): void
    {
        C::preparer($test);
    }

    /**
     * @return array{org: Organization, owner: User, unit: Unit, property: string}
     */
    public static function bailleur(string $nom = 'Mme Martin'): array
    {
        $org = C::organisation(OrganizationKind::Individual, $nom);
        $lot = L::lot($org);

        return ['org' => $org, 'owner' => L::titulaire($org), 'unit' => $lot, 'property' => $lot->property_id];
    }

    /**
     * @return array{org: Organization, owner: User, unit: Unit, property: string}
     */
    public static function agence(): array
    {
        $org = C::organisation();
        $lot = L::lot($org);

        return ['org' => $org, 'owner' => L::titulaire($org), 'unit' => $lot, 'property' => $lot->property_id];
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
        return "/api/v1/org/{$org->id}/investments{$chemin}";
    }

    public static function pdf(string $nom = 'piece.pdf'): UploadedFile
    {
        return DocumentsContext::pdf($nom);
    }

    /**
     * Prêt de 12 000,00 € à 12 % sur 12 mois, première échéance le 5 janvier 2026 (valeurs de référence calculées à part).
     *
     * @param  array<string, mixed>  $scene
     * @param  array<string, mixed>  $corps
     */
    public static function pret(object $test, array $scene, array $corps = [], ?string $cle = null): TestResponse
    {
        return $test->postJson(self::url($scene['org'], '/loans'), [
            'property_id' => $scene['property'],
            'lender_label' => 'Banque du Nord',
            'contract_reference' => 'PRET-2026-0042',
            'purpose' => 'acquisition',
            'principal' => 1200000,
            'nominal_rate' => '12',
            'first_due_on' => '2026-01-05',
            'term_months' => 12,
            ...$corps,
        ], ['Idempotency-Key' => $cle ?? 'pret-'.bin2hex(random_bytes(6))]);
    }
}
