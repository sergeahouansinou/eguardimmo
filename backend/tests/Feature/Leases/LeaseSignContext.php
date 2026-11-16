<?php

declare(strict_types=1);

namespace Tests\Feature\Leases;

use App\Modules\Leases\Actions\SignLease;
use App\Modules\Leases\Data\SignLeaseData;
use App\Modules\Leases\Models\Lease;
use App\Modules\Leases\Models\LeaseParty;
use App\Modules\Leases\Models\LeaseTerm;
use App\Modules\Leases\Models\LeaseUnit;
use App\Modules\Organizations\Models\Organization;
use App\Modules\Parties\Models\Party;
use App\Modules\Properties\Models\Unit;
use App\Shared\Http\ApiProblem;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class LeaseSignContext
{
    /**
     * @param  array<string, mixed>  $surcharges
     * @return array<string, mixed>
     */
    public static function corps(Lease $bail, array $surcharges = []): array
    {
        return ['signed_on' => '2026-11-10', 'lock_version' => $bail->lock_version, ...$surcharges];
    }

    public static function url(object $test, string $id): string
    {
        return "/api/v1/org/{$test->org->id}/leases/{$id}/sign";
    }

    public static function appliquer(object $test, Lease $bail, ?string $fichier = null, ?string $date = null, ?int $version = null): Lease
    {
        return LeasesContext::dans($test->org, fn (): Lease => app(SignLease::class)->handle($bail, new SignLeaseData($date ?? '2026-11-10', $fichier, $version ?? $bail->lock_version)));
    }

    public static function refus(object $test, Lease $bail, string $code, int $statut): void
    {
        try {
            self::appliquer($test, $bail);
            $erreur = null;
        } catch (ApiProblem $probleme) {
            $erreur = $probleme;
        }

        expect($erreur)->not->toBeNull()
            ->and($erreur?->problemCode)->toBe($code)
            ->and($erreur?->status)->toBe($statut);
        expect(LeasesContext::dans($test->org, fn () => Lease::query()->find($bail->id)?->status))->toBe($bail->status);
    }

    /**
     * Brouillon complet et signable : un lot principal, un locataire ouvert et une ligne de loyer en vigueur au début.
     *
     * @param  array<string, mixed>  $attributs
     * @return array{bail: Lease, lot: Unit, locataire: Party}
     */
    public static function brouillon(Organization $organisation, array $attributs = [], ?Unit $lot = null): array
    {
        $bail = LeasesContext::bail($organisation, ['starts_on' => '2026-01-01', 'duration_months' => 36, 'tacit_renewal' => false, 'ends_on' => null, ...$attributs]);
        $lot ??= LeasesContext::lot($organisation);
        $locataire = LeasesContext::partie($organisation);

        LeasesReadContext::occuper($organisation, $bail, $lot);
        LeasesReadContext::lier($organisation, $bail, $locataire);
        LeasesReadContext::terme($organisation, $bail, 'rent', [...LeasesReadContext::loyer(65000), 'valid_from' => $bail->starts_on->toDateString()]);

        return ['bail' => $bail, 'lot' => $lot, 'locataire' => $locataire];
    }

    /**
     * @param  array<string, mixed>  $attributs
     */
    public static function bailSigneSur(Organization $organisation, Unit $lot, array $attributs = [], bool $reconduit = false): Lease
    {
        $bail = LeasesReadContext::bailSigne($organisation, ['starts_on' => '2026-01-01', 'tacit_renewal' => $reconduit, 'ends_on' => $reconduit ? null : '2029-01-01', ...$attributs]);
        LeasesReadContext::occuper($organisation, $bail, $lot);

        return $bail;
    }

    /**
     * Écrit en SQL, sans contexte ni événement : simule une écriture concurrente d'une autre transaction.
     */
    public static function insererBailSigne(string $organisationId, string $lotId, string $debut = '2026-01-01', ?string $fin = null): string
    {
        $id = (string) Str::uuid7();
        $maintenant = now()->format('Y-m-d H:i:s.u');

        DB::table('leases')->insert([
            'id' => $id, 'organization_id' => $organisationId, 'reference' => 'BL-2026-'.random_int(5000, 9999), 'jurisdiction' => 'FR',
            'regime_key' => 'fr.residential.unfurnished', 'status' => 'signed', 'starts_on' => $debut, 'duration_months' => 36, 'tacit_renewal' => $fin === null,
            'ends_on' => $fin, 'due_day' => 5, 'periodicity' => 'monthly', 'billing_timing' => 'advance', 'currency' => 'EUR', 'signed_on' => '2025-12-01',
            'lock_version' => 1, 'created_at' => $maintenant, 'updated_at' => $maintenant,
        ]);
        DB::table('lease_units')->insert([
            'id' => (string) Str::uuid7(), 'organization_id' => $organisationId, 'lease_id' => $id, 'unit_id' => $lotId, 'is_main' => true,
            'valid_from' => $debut, 'created_at' => $maintenant, 'updated_at' => $maintenant,
        ]);

        return $id;
    }

    public static function retirer(Organization $organisation, Lease $bail, string $table): void
    {
        $modele = match ($table) {
            'units' => LeaseUnit::class,
            'parties' => LeaseParty::class,
            default => LeaseTerm::class,
        };

        LeasesContext::dans($organisation, fn () => $modele::query()->where('lease_id', $bail->id)->get()->each->delete());
    }
}
