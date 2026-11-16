<?php

declare(strict_types=1);

use App\Modules\Leases\Actions\VerifyLeases;
use App\Modules\Leases\Enums\LeaseStatus;
use App\Modules\Leases\Models\Lease;
use App\Modules\Leases\Models\LeaseUnit;
use App\Modules\Organizations\Models\Organization;
use App\Modules\Properties\Models\Unit;
use Carbon\CarbonImmutable;
use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Money\Money;
use Tests\Feature\Leases\LeasesContext as L;
use Tests\Feature\Leases\LeaseSignContext as S;
use Tests\Feature\Leases\LeasesReadContext as R;

beforeEach(function (): void {
    L::semer();
    $this->org = L::organisation();
    $this->travelTo(CarbonImmutable::parse('2026-11-16 10:00:00'));
});

/**
 * Bail signé complet : lot principal, locataire et loyer en vigueur au début.
 *
 * @param  array<string, mixed>  $attributs
 * @return array{bail: Lease, lot: Unit}
 */
function leaseVerifBailSain(Organization $org, array $attributs = [], ?Unit $lot = null): array
{
    ['bail' => $bail, 'lot' => $lot] = S::brouillon($org, $attributs, $lot);
    L::dans($org, fn () => $bail->forceFill(['status' => LeaseStatus::Signed, 'signed_on' => '2025-12-15', 'ends_on' => $attributs['ends_on'] ?? '2029-01-01'])->save());

    return ['bail' => $bail->refresh(), 'lot' => $lot];
}

/**
 * @return list<string>
 */
function leaseVerifGenres(): array
{
    $genres = array_map(fn ($a): string => $a->kind->value, app(VerifyLeases::class)->handle());
    sort($genres);

    return $genres;
}

/**
 * @return array<string, int|string>
 */
function leaseVerifEmpreinte(): array
{
    $empreinte = [];

    foreach (['leases', 'lease_units', 'lease_parties', 'lease_terms', 'audit_logs', 'lease_unit_locks', 'units', 'parties'] as $table) {
        $empreinte[$table] = DB::table($table)->count().'|'.md5(DB::table($table)->orderBy('id')->get()->toJson());
    }

    return $empreinte;
}

it('ne signale rien sur un jeu sain et sort en succès', function (): void {
    ['bail' => $premier, 'lot' => $lot] = leaseVerifBailSain($this->org, ['starts_on' => '2023-01-01', 'duration_months' => 36, 'ends_on' => '2026-01-01']);
    leaseVerifBailSain($this->org, ['starts_on' => '2026-01-01'], $lot);
    L::dans($this->org, fn () => $premier->forceFill(['status' => LeaseStatus::Terminated, 'ends_on' => '2026-01-01'])->save());
    S::brouillon($this->org);
    S::retirer($this->org, S::brouillon($this->org)['bail'], 'terms');
    L::bail($this->org, ['status' => LeaseStatus::Cancelled, 'signed_on' => '2025-12-01']);
    $autre = L::organisation();
    leaseVerifBailSain($autre);
    Log::spy();
    $avant = leaseVerifEmpreinte();

    $this->artisan('leases:verify')->expectsOutput('Baux cohérents.')->assertSuccessful();

    Log::shouldNotHaveReceived('critical');
    expect(leaseVerifEmpreinte())->toBe($avant);
});

it('réussit sans aucune donnée', function (): void {
    $this->artisan('leases:verify')->assertSuccessful();
});

it('relève deux baux signés qui se recoupent sur un lot, sans écrire', function (): void {
    ['lot' => $lot] = leaseVerifBailSain($this->org);
    ['bail' => $second] = leaseVerifBailSain($this->org, ['starts_on' => '2028-06-01', 'ends_on' => '2030-01-01'], $lot);
    Log::spy();
    $avant = leaseVerifEmpreinte();

    $this->artisan('leases:verify')->assertFailed();

    Log::shouldHaveReceived('critical')->once()->withArgs(fn (string $m, array $c): bool => $c['kind'] === 'unit_overlap' && $c['lease_id'] === $second->id && $c['organization_id'] === $this->org->id);
    expect(leaseVerifEmpreinte())->toBe($avant);
});

it('relève un recoupement avec un bail reconduit sans fin', function (): void {
    ['lot' => $lot] = leaseVerifBailSain($this->org, ['tacit_renewal' => true, 'ends_on' => null]);
    L::dans($this->org, fn () => Lease::query()->update(['ends_on' => null]));
    leaseVerifBailSain($this->org, ['starts_on' => '2040-01-01', 'ends_on' => '2042-01-01'], $lot);

    expect(leaseVerifGenres())->toBe(['unit_overlap']);
});

it('ne signale pas deux baux qui se suivent, ends_on étant exclu', function (): void {
    ['lot' => $lot] = leaseVerifBailSain($this->org, ['starts_on' => '2023-01-01', 'ends_on' => '2026-01-01']);
    leaseVerifBailSain($this->org, ['starts_on' => '2026-01-01', 'ends_on' => '2029-01-01'], $lot);

    expect(leaseVerifGenres())->toBe([]);
});

it('relève un bail signé sans locataire ouvert, sans lot principal ou sans loyer', function (): void {
    ['bail' => $sansLocataire] = leaseVerifBailSain($this->org);
    S::retirer($this->org, $sansLocataire, 'parties');
    ['bail' => $sansLot] = leaseVerifBailSain($this->org);
    S::retirer($this->org, $sansLot, 'units');
    ['bail' => $sansLoyer] = leaseVerifBailSain($this->org);
    S::retirer($this->org, $sansLoyer, 'terms');
    R::terme($this->org, $sansLoyer, 'charges_provision', R::loyer(8000));

    expect(leaseVerifGenres())->toBe(['no_main_unit', 'no_rent', 'no_tenant']);
});

it('compte un loyer clos avant le début comme absent, et un locataire parti comme absent', function (): void {
    ['bail' => $bail] = leaseVerifBailSain($this->org);
    S::retirer($this->org, $bail, 'terms');
    S::retirer($this->org, $bail, 'parties');
    R::terme($this->org, $bail, 'rent', [...R::loyer(65000), 'valid_to' => '2026-01-01']);
    R::lier($this->org, $bail, L::partie($this->org), ['valid_to' => '2026-05-01']);

    expect(leaseVerifGenres())->toBe(['no_rent', 'no_tenant']);
});

it('relève un lot archivé dans Properties et un lot introuvable', function (): void {
    ['bail' => $archive, 'lot' => $lot] = leaseVerifBailSain($this->org);
    L::dans($this->org, fn () => $lot->forceFill(['archived_at' => now()])->save());
    ['bail' => $fantome] = leaseVerifBailSain($this->org);
    L::dans($this->org, fn () => LeaseUnit::query()->where('lease_id', $fantome->id)->update(['unit_id' => (string) Str::uuid7()]));

    expect(leaseVerifGenres())->toBe(['unit_archived', 'unit_missing']);
});

it('relève deux lignes de la même composante qui se recoupent, et pas deux composantes différentes', function (): void {
    ['bail' => $bail] = leaseVerifBailSain($this->org);
    R::terme($this->org, $bail, 'charges_provision', [...R::loyer(8000), 'valid_to' => '2026-07-01']);
    R::terme($this->org, $bail, 'charges_provision', [...R::loyer(9000), 'valid_from' => '2026-07-01']);
    R::terme($this->org, $bail, 'rent_supplement', [...R::loyer(1000), 'valid_to' => '2026-07-01']);

    expect(leaseVerifGenres())->toBe([]);

    R::terme($this->org, $bail, 'charges_provision', [...R::loyer(9500), 'valid_from' => '2026-09-01', 'valid_to' => '2026-12-01']);

    expect(leaseVerifGenres())->toBe(['term_overlap']);
});

it('relève une ligne de composante dans une autre devise que le bail', function (): void {
    ['bail' => $bail] = leaseVerifBailSain($this->org);
    R::terme($this->org, $bail, 'charges_provision', ['amount' => Money::USD(8000)]);

    expect(leaseVerifGenres())->toBe(['currency_mismatch']);
});

it('parcourt toutes les organisations et nomme celle qui est fautive', function (): void {
    leaseVerifBailSain($this->org);
    $autre = L::organisation();
    ['bail' => $faute] = leaseVerifBailSain($autre);
    S::retirer($autre, $faute, 'parties');
    Log::spy();

    $this->artisan('leases:verify')->assertFailed();

    Log::shouldHaveReceived('critical')->once()->withArgs(fn (string $m, array $c): bool => $c['organization_id'] === $autre->id && $c['kind'] === 'no_tenant' && $c['lease_id'] === $faute->id);
});

it('ne mélange pas les occupations de deux organisations sur un même identifiant de lot', function (): void {
    ['lot' => $lot] = leaseVerifBailSain($this->org);
    $autre = L::organisation();
    S::bailSigneSur($autre, $lot);

    expect(leaseVerifGenres())->not->toContain('unit_overlap');
});

it('est planifié chaque jour à 03:50', function (): void {
    $evenements = collect(app(Schedule::class)->events())->filter(fn ($evenement): bool => str_contains((string) $evenement->command, 'leases:verify'));

    expect($evenements)->toHaveCount(1)->and($evenements->first()->expression)->toBe('50 3 * * *');
});
