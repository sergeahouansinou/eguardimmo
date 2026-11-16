<?php

declare(strict_types=1);

use App\Modules\Leases\Enums\LeasePartyRole;
use App\Modules\Leases\Enums\LeaseStatus;
use Carbon\CarbonImmutable;
use Tests\Feature\Leases\LeasesContext as L;
use Tests\Feature\Leases\LeasesReadContext as R;

beforeEach(function (): void {
    L::semer();
    $this->org = L::organisation();
    $this->titulaire = L::titulaire($this->org);
    $this->travelTo(CarbonImmutable::parse('2026-11-16 10:00:00'));
    $this->actingAs($this->titulaire);
});

it('donne le bail qui occupe chaque lot à la date, ou vacant', function (): void {
    $occupe = L::lot($this->org);
    $libre = L::lot($this->org);
    $locataire = L::partie($this->org);
    $garant = L::partie($this->org);
    $bail = R::bailSigne($this->org, ['reference' => 'BL-2026-0001', 'starts_on' => '2026-01-01', 'ends_on' => '2029-01-01']);
    R::occuper($this->org, $bail, $occupe, ['valid_from' => '2026-02-01']);
    R::lier($this->org, $bail, $locataire);
    R::lier($this->org, $bail, $garant, ['role' => LeasePartyRole::Guarantor]);

    $reponse = $this->getJson(R::url($this->org, "/occupancy?units[]={$occupe->id}&units[]={$libre->id}"))->assertOk();

    $reponse
        ->assertJsonPath('data.0.unit.id', $occupe->id)
        ->assertJsonPath('data.0.vacant', false)
        ->assertJsonPath('data.0.since', '2026-02-01')
        ->assertJsonPath('data.0.lease.id', $bail->id)
        ->assertJsonPath('data.0.lease.reference', 'BL-2026-0001')
        ->assertJsonPath('data.0.lease.phase', 'running')
        ->assertJsonPath('data.0.lease.end_date', '2028-12-31')
        ->assertJsonPath('data.1.unit.id', $libre->id)
        ->assertJsonPath('data.1.vacant', true)
        ->assertJsonPath('data.1.lease', null)
        ->assertJsonPath('data.1.since', null);

    expect($reponse->json('data.0.lease.tenants'))->toHaveCount(1)
        ->and($reponse->json('data.0.lease.tenants.0.id'))->toBe($locataire->id)
        ->and($reponse->json('data.0.lease.tenants.0.display_name'))->toBe($locataire->display_name);
});

it('lit l\'occupation à la date demandée, fin de bail exclue', function (): void {
    $lot = L::lot($this->org);
    $bail = R::bailSigne($this->org, ['starts_on' => '2026-01-01', 'ends_on' => '2026-12-01']);
    R::occuper($this->org, $bail, $lot, ['valid_from' => '2026-01-01']);
    $vacant = fn (string $date): bool => $this->getJson(R::url($this->org, "/occupancy?units[]={$lot->id}&date={$date}"))->assertOk()->json('data.0.vacant');

    expect($vacant('2025-12-31'))->toBeTrue()
        ->and($vacant('2026-01-01'))->toBeFalse()
        ->and($vacant('2026-11-30'))->toBeFalse()
        ->and($vacant('2026-12-01'))->toBeTrue();

    $this->getJson(R::url($this->org, "/occupancy?units[]={$lot->id}&date=2026-12-01"))->assertJsonPath('data.0.lease', null);
    $this->getJson(R::url($this->org, "/occupancy?units[]={$lot->id}&date=2026-13-45"))->assertUnprocessable();
});

it('ne compte ni brouillon, ni bail annulé, ni occupation fermée, ni bail terminé sans fin', function (): void {
    $lots = array_map(fn () => L::lot($this->org), range(1, 5));
    $brouillon = L::bail($this->org, ['reference' => 'BL-2026-0001']);
    $annule = R::bailSigne($this->org, ['reference' => 'BL-2026-0002', 'status' => LeaseStatus::Cancelled]);
    $ferme = R::bailSigne($this->org, ['reference' => 'BL-2026-0003']);
    $termine = R::bailSigne($this->org, ['reference' => 'BL-2026-0004', 'status' => LeaseStatus::Terminated, 'ends_on' => null]);
    $termineDate = R::bailSigne($this->org, ['reference' => 'BL-2026-0005', 'status' => LeaseStatus::Terminated, 'ends_on' => '2027-03-01']);
    R::occuper($this->org, $brouillon, $lots[0]);
    R::occuper($this->org, $annule, $lots[1]);
    R::occuper($this->org, $ferme, $lots[2], ['valid_to' => '2026-06-01']);
    R::occuper($this->org, $termine, $lots[3]);
    R::occuper($this->org, $termineDate, $lots[4]);
    $ids = implode('&', array_map(fn ($lot) => "units[]={$lot->id}", $lots));

    $reponse = $this->getJson(R::url($this->org, "/occupancy?{$ids}"))->assertOk();

    expect(collect($reponse->json('data'))->pluck('vacant')->all())->toBe([true, true, true, true, false])
        ->and($reponse->json('data.4.lease.phase'))->toBe('running');
});

it('valide, plafonne à 200 lots et refuse les lots d\'une autre organisation', function (): void {
    $autre = L::organisation();
    $lotAutre = L::lot($autre);
    $lot = L::lot($this->org);

    $this->getJson(R::url($this->org, '/occupancy'))->assertUnprocessable();
    $this->getJson(R::url($this->org, '/occupancy?units=abc'))->assertUnprocessable();
    $this->getJson(R::url($this->org, '/occupancy?units[]=pas-un-uuid'))->assertUnprocessable();
    $this->getJson(R::url($this->org, '/occupancy?units[]='.implode('&units[]=', array_map(fn () => fake()->uuid(), range(1, 201)))))->assertUnprocessable();
    $this->getJson(R::url($this->org, "/occupancy?units[]={$lot->id}&units[]={$lotAutre->id}"))->assertNotFound()->assertJsonPath('code', 'unit_not_found');
    $this->getJson(R::url($this->org, '/occupancy?units[]='.fake()->uuid()))->assertNotFound()->assertJsonPath('code', 'unit_not_found');
});

it('ne répond pas deux fois pour un lot demandé deux fois', function (): void {
    $lot = L::lot($this->org);

    expect($this->getJson(R::url($this->org, "/occupancy?units[]={$lot->id}&units[]={$lot->id}"))->assertOk()->json('data'))->toHaveCount(1);
});

it('liste les baux de chaque partie avec rôle, phase, lot principal et date d\'entrée', function (): void {
    $partie = L::partie($this->org);
    $sansBail = L::partie($this->org);
    $lot = L::lot($this->org);
    $courant = R::bailSigne($this->org, ['reference' => 'BL-2026-0001', 'starts_on' => '2026-01-01', 'ends_on' => '2029-01-01']);
    $ancien = R::bailSigne($this->org, ['reference' => 'BL-2026-0002', 'starts_on' => '2023-01-01', 'ends_on' => '2024-01-01']);
    $brouillon = L::bail($this->org, ['reference' => 'BL-2026-0003']);
    $archive = R::bailSigne($this->org, ['reference' => 'BL-2026-0004', 'archived_at' => now()]);
    R::occuper($this->org, $courant, $lot);
    R::lier($this->org, $courant, $partie, ['valid_from' => '2026-01-15']);
    R::lier($this->org, $ancien, $partie, ['valid_from' => '2023-01-01', 'valid_to' => '2024-01-01']);
    R::lier($this->org, $brouillon, $partie, ['role' => LeasePartyRole::Guarantor, 'valid_from' => '2026-12-01']);
    R::lier($this->org, $archive, $partie);

    $reponse = $this->getJson(R::url($this->org, "/tenancies?parties[]={$partie->id}&parties[]={$sansBail->id}"))->assertOk();

    $reponse
        ->assertJsonPath('data.0.party.id', $partie->id)
        ->assertJsonPath('data.0.party.display_name', $partie->display_name)
        ->assertJsonPath('data.1.party.id', $sansBail->id)
        ->assertJsonPath('data.1.leases', [])
        ->assertJsonPath('data.0.leases.0.reference', 'BL-2026-0003')
        ->assertJsonPath('data.0.leases.0.role', 'guarantor')
        ->assertJsonPath('data.0.leases.0.phase', 'draft')
        ->assertJsonPath('data.0.leases.0.main_unit', null)
        ->assertJsonPath('data.0.leases.1.id', $courant->id)
        ->assertJsonPath('data.0.leases.1.role', 'tenant')
        ->assertJsonPath('data.0.leases.1.phase', 'running')
        ->assertJsonPath('data.0.leases.1.main_unit.id', $lot->id)
        ->assertJsonPath('data.0.leases.1.since', '2026-01-15')
        ->assertJsonPath('data.0.leases.1.end_date', null)
        ->assertJsonPath('data.0.leases.2.reference', 'BL-2026-0002')
        ->assertJsonPath('data.0.leases.2.phase', 'ended')
        ->assertJsonPath('data.0.leases.2.end_date', '2023-12-31');

    expect($reponse->json('data.0.leases'))->toHaveCount(3);
});

it('valide les parties demandées et refuse celles d\'une autre organisation', function (): void {
    $autre = L::organisation();
    $partieAutre = L::partie($autre);
    $partie = L::partie($this->org);

    $this->getJson(R::url($this->org, '/tenancies'))->assertUnprocessable();
    $this->getJson(R::url($this->org, '/tenancies?parties[]=abc'))->assertUnprocessable();
    $this->getJson(R::url($this->org, '/tenancies?parties[]='.implode('&parties[]=', array_map(fn () => fake()->uuid(), range(1, 101)))))->assertUnprocessable();
    $this->getJson(R::url($this->org, "/tenancies?parties[]={$partie->id}&parties[]={$partieAutre->id}"))->assertNotFound()->assertJsonPath('code', 'party_not_found');
});
