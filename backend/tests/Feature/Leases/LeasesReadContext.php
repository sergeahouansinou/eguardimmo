<?php

declare(strict_types=1);

namespace Tests\Feature\Leases;

use App\Modules\Identity\Models\User;
use App\Modules\Leases\Enums\LeaseStatus;
use App\Modules\Leases\Models\Lease;
use App\Modules\Leases\Models\LeaseParty;
use App\Modules\Leases\Models\LeaseTerm;
use App\Modules\Leases\Models\LeaseUnit;
use App\Modules\Organizations\Models\Organization;
use App\Modules\Parties\Models\Party;
use App\Modules\Properties\Models\Unit;
use App\Shared\Tenancy\CurrentOrganization;
use Illuminate\Support\Facades\DB;
use Money\Money;

final class LeasesReadContext
{
    public static function url(Organization $organisation, string $chemin = ''): string
    {
        return "/api/v1/org/{$organisation->id}/leases{$chemin}";
    }

    public static function changerDeCompte(mixed $test, User $compte): mixed
    {
        auth()->forgetGuards();
        app()->forgetInstance(CurrentOrganization::class);
        app()->forgetScopedInstances();

        return $test->actingAs($compte);
    }

    /**
     * @param  array<string, mixed>  $attributs
     */
    public static function bailSigne(Organization $organisation, array $attributs = []): Lease
    {
        return LeasesContext::dans($organisation, fn (): Lease => Lease::factory()->create([
            'status' => LeaseStatus::Signed,
            'signed_on' => '2025-12-15',
            ...$attributs,
        ]));
    }

    /**
     * @param  array<string, mixed>  $attributs
     */
    public static function occuper(Organization $organisation, Lease $bail, Unit $lot, array $attributs = []): LeaseUnit
    {
        return LeasesContext::dans($organisation, fn (): LeaseUnit => LeaseUnit::factory()->create([
            'lease_id' => $bail->id,
            'unit_id' => $lot->id,
            ...$attributs,
        ]));
    }

    /**
     * @param  array<string, mixed>  $attributs
     */
    public static function lier(Organization $organisation, Lease $bail, Party $partie, array $attributs = []): LeaseParty
    {
        return LeasesContext::dans($organisation, fn (): LeaseParty => LeaseParty::factory()->create([
            'lease_id' => $bail->id,
            'party_id' => $partie->id,
            ...$attributs,
        ]));
    }

    /**
     * @param  array<string, mixed>  $attributs
     */
    public static function terme(Organization $organisation, Lease $bail, string $composante = 'rent', array $attributs = []): LeaseTerm
    {
        return LeasesContext::dans($organisation, fn (): LeaseTerm => LeaseTerm::factory()->create([
            'lease_id' => $bail->id,
            'component_term_id' => LeasesContext::composante($composante)->id,
            ...$attributs,
        ]));
    }

    /**
     * @return array<string, mixed>
     */
    public static function loyer(int $centimes): array
    {
        return ['amount' => Money::EUR($centimes)];
    }

    /**
     * Compte les requêtes qui touchent les tables du bail pendant l'appel.
     */
    public static function requetesDuBail(callable $appel): int
    {
        DB::flushQueryLog();
        DB::enableQueryLog();
        $appel();
        $requetes = DB::getQueryLog();
        DB::disableQueryLog();

        return count(array_filter($requetes, fn (array $r): bool => preg_match('/"lease_(units|parties|terms)"|"leases"/', (string) $r['query']) === 1));
    }
}
