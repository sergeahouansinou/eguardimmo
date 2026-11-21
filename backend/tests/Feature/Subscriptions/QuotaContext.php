<?php

declare(strict_types=1);

namespace Tests\Feature\Subscriptions;

use App\Modules\Identity\Models\User;
use App\Modules\Inspections\Models\Inspection;
use App\Modules\Leases\Models\Lease;
use App\Modules\Organizations\Enums\MemberRole;
use App\Modules\Organizations\Models\Organization;
use App\Modules\Organizations\Models\OrganizationMember;
use App\Modules\Properties\Models\Unit;
use App\Modules\Subscriptions\Enums\Feature;
use App\Modules\Subscriptions\Enums\SubscriptionStatus;
use App\Modules\Subscriptions\Models\OrganizationEntitlementOverride;
use App\Modules\Subscriptions\Models\Subscription;
use App\Modules\Subscriptions\Support\PlanGrid;
use App\Shared\Tenancy\AcrossOrganizations;
use Closure;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Testing\TestResponse;
use Tests\Feature\Leases\LeaseDraftContext as D;
use Tests\Feature\Leases\LeasesContext as L;
use Tests\Feature\Properties\PropertiesContext as P;
use Tests\Feature\Tenant\TenantContext as T;
use Tests\Feature\Tenant\TenantWriteContext as W;

final class QuotaContext
{
    public static function demarrer(): void
    {
        L::semer();
        app(PlanGrid::class)->seed();
    }

    public static function organisation(): Organization
    {
        return T::organisation();
    }

    public static function gratuit(Organization $organisation): void
    {
        AcrossOrganizations::query(Subscription::class)->where('organization_id', $organisation->id)->update(['status' => SubscriptionStatus::Free]);
    }

    public static function sansAbonnement(Organization $organisation): void
    {
        DB::table('subscriptions')->where('organization_id', $organisation->id)->delete();
    }

    public static function deroger(Organization $organisation, Feature $fonction, ?int $limite, bool $active = true): void
    {
        L::dans($organisation, fn (): OrganizationEntitlementOverride => OrganizationEntitlementOverride::query()->create([
            'feature_key' => $fonction->value, 'enabled' => $active, 'limit_value' => $limite,
            'starts_at' => now()->subMinute(), 'ends_at' => now()->addDays(30), 'reason_code' => 'pilot', 'approval_id' => (string) Str::uuid7(),
        ]));
    }

    /**
     * Une entrée par route de création plafonnée : limite du plan Gratuit, compteur, ajout direct, appel HTTP et lecture libre.
     *
     * @return array<string, array<string, mixed>>
     */
    public static function ressources(): array
    {
        $compter = fn (string $modele, bool $archives = false): Closure => fn (Organization $org): int => L::dans($org, fn (): int => $archives
            ? $modele::query()->whereNull('archived_at')->count()
            : $modele::query()->count());

        return [
            'lots' => [
                'feature' => Feature::Properties, 'limite' => 1, 'compter' => $compter(Unit::class, true),
                'ajouter' => fn (Organization $org): mixed => P::lot($org, P::site($org)),
                'creer' => fn (mixed $test, Organization $org, User $u): TestResponse => self::comme($test, $u)->postJson(P::url($org, '/units'), [
                    'property_id' => P::site($org)->id, 'unit_type_term_id' => P::terme('unit_type', 'apartment')->id,
                    'reference' => 'L-'.Str::random(6), 'floor' => 1, 'surface_hundredths' => 5000,
                ]),
                'lire' => '/units',
            ],
            'baux' => [
                'feature' => Feature::Leases, 'limite' => 2, 'compter' => $compter(Lease::class, true),
                'ajouter' => fn (Organization $org): mixed => L::bail($org),
                'creer' => fn (mixed $test, Organization $org, User $u): TestResponse => self::comme($test, $u)->postJson(P::url($org, '/leases'), D::payload(L::lot($org), L::partie($org))),
                'lire' => '/leases',
            ],
            'etats des lieux' => [
                'feature' => Feature::Inspections, 'limite' => 4, 'compter' => $compter(Inspection::class),
                'ajouter' => fn (Organization $org): mixed => L::dans($org, fn (): mixed => Inspection::factory()->create(['lease_id' => L::bail($org)->id])),
                'creer' => fn (mixed $test, Organization $org, User $u, array $corps = []): TestResponse => self::enregistrer($test, $org, $u, $corps),
                'lire' => '/leases',
            ],
            'utilisateurs' => [
                'feature' => Feature::Users, 'limite' => 1, 'compter' => $compter(OrganizationMember::class),
                'ajouter' => fn (Organization $org): mixed => L::membre($org, MemberRole::Manager),
                'creer' => fn (mixed $test, Organization $org, User $u): TestResponse => self::comme($test, $u)->postJson(P::url($org, '/members'), [
                    'email' => Str::lower(Str::random(8)).'@exemple.fr', 'first_name' => 'Jo', 'last_name' => 'Lu', 'role' => 'manager', 'scope' => ['type' => 'all'],
                ]),
                'lire' => '/members',
            ],
        ];
    }

    /**
     * @param  array<string, mixed>  $corps
     */
    public static function enregistrer(mixed $test, Organization $org, User $utilisateur, array $corps = []): TestResponse
    {
        $bail = $corps['_bail'] ?? L::bail($org)->id;
        unset($corps['_bail']);

        return self::comme($test, $utilisateur)->post(P::url($org, "/leases/{$bail}/inspections"), [
            'file' => W::pdf('etat-des-lieux.pdf'), 'kind' => 'entry', 'performed_on' => '2026-11-10', 'performed_by' => 'agent',
            'signatories' => [['name' => 'Agent Immo', 'capacity' => 'Mandataire', 'date' => '2026-11-10']],
            'client_id' => (string) Str::uuid7(),
            ...$corps,
        ], ['Accept' => 'application/json']);
    }

    /**
     * @param  array<string, mixed>  $ressource
     */
    public static function remplir(Organization $organisation, array $ressource, int $cible): void
    {
        while ($cible > $ressource['compter']($organisation)) {
            $ressource['ajouter']($organisation);
        }
    }

    public static function comme(mixed $test, User $compte): mixed
    {
        return T::comme($test, $compte);
    }
}
