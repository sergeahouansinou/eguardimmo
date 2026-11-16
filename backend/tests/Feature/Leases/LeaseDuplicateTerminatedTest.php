<?php

declare(strict_types=1);

use App\Modules\Leases\Actions\DuplicateLease;
use App\Modules\Leases\Enums\LeaseStatus;
use App\Modules\Leases\Enums\NoticeGivenBy;
use App\Modules\Leases\Http\Requests\DuplicateLeaseRequest;
use App\Modules\Leases\Models\Lease;
use App\Modules\Leases\Models\LeaseParty;
use App\Modules\Leases\Models\LeaseTerm;
use App\Modules\Leases\Models\LeaseUnit;
use Carbon\CarbonImmutable;
use Tests\Feature\Leases\LeaseDraftContext as D;
use Tests\Feature\Leases\LeaseEndContext as E;
use Tests\Feature\Leases\LeasesContext as L;
use Tests\Feature\Leases\LeasesReadContext as R;

beforeEach(function (): void {
    L::semer();
    $this->org = L::organisation();
    $this->titulaire = L::titulaire($this->org);
    $this->travelTo(CarbonImmutable::parse('2026-11-16 10:00:00'));
    $this->actingAs($this->titulaire);
});

it('copie les lignes en vigueur à la dernière journée d\'un bail terminé, pas celles déjà fermées', function (): void {
    ['bail' => $bail, 'lot' => $lot, 'locataire' => $locataire] = E::bail($this->org);
    $annexe = L::lot($this->org);
    $ancien = L::lot($this->org);
    $ancienne = L::partie($this->org);
    R::occuper($this->org, $bail, $annexe, ['is_main' => false, 'valid_from' => '2026-02-01']);
    R::occuper($this->org, $bail, $ancien, ['is_main' => false, 'valid_from' => '2026-01-01', 'valid_to' => '2026-03-01']);
    R::lier($this->org, $bail, $ancienne, ['valid_from' => '2026-01-01', 'valid_to' => '2026-03-01']);
    R::terme($this->org, $bail, 'charges_provision', ['valid_from' => '2026-01-01', 'valid_to' => '2026-04-01']);
    R::terme($this->org, $bail, 'charges_provision', ['valid_from' => '2026-04-01']);

    E::resilier($this->org, $bail, E::fin($bail, ['fin' => '2026-06-01', 'amiable' => true, 'motif' => 'Accord des parties', 'par' => NoticeGivenBy::Tenant]));

    $copie = L::dans($this->org, fn (): Lease => app(DuplicateLease::class)->handle(
        Lease::query()->findOrFail($bail->id),
        D::requete(DuplicateLeaseRequest::class, ['starts_on' => '2027-01-01'])->toData(),
    ));

    $lots = L::dans($this->org, fn (): array => LeaseUnit::query()->where('lease_id', $copie->id)->pluck('unit_id')->sort()->values()->all());
    $parties = L::dans($this->org, fn (): array => LeaseParty::query()->where('lease_id', $copie->id)->pluck('party_id')->all());
    $termes = L::dans($this->org, fn (): int => LeaseTerm::query()->where('lease_id', $copie->id)->count());

    expect(L::dans($this->org, fn () => Lease::query()->findOrFail($bail->id)->status))->toBe(LeaseStatus::Terminated)
        ->and($copie->status)->toBe(LeaseStatus::Draft)
        ->and($lots)->toBe(collect([$lot->id, $annexe->id])->sort()->values()->all())
        ->and($parties)->toBe([$locataire->id])
        ->and($termes)->toBe(2);
});
