<?php

declare(strict_types=1);

use App\Modules\Leases\Enums\NoticeGivenBy;
use Carbon\CarbonImmutable;
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

function leaseTacitePartant(object $test): array
{
    $donnees = E::bail($test->org, [
        'duration_months' => 12, 'tacit_renewal' => true, 'ends_on' => null,
        'notice_given_by' => NoticeGivenBy::Tenant, 'notice_received_on' => '2026-09-20',
        'notice_departure_on' => '2027-01-01', 'termination_reason' => 'Mutation',
    ]);

    return $donnees;
}

function leaseSuivant(object $test, object $lot, string $debut): object
{
    $bail = R::bailSigne($test->org, ['starts_on' => $debut, 'duration_months' => 36, 'tacit_renewal' => false, 'ends_on' => '2030-06-01', 'signed_on' => '2026-10-01']);
    R::occuper($test->org, $bail, $lot, ['valid_from' => $debut]);

    return $bail;
}

it('refuse de résilier après le départ du préavis quand un autre bail occupe déjà le lot', function (): void {
    ['bail' => $bail, 'lot' => $lot] = leaseTacitePartant($this);
    leaseSuivant($this, $lot, '2027-01-01');
    $avant = [E::champs($this->org, $bail), E::lignes($this->org, $bail)];

    E::refus(fn () => E::resilier($this->org, $bail, E::fin($bail, ['fin' => '2027-06-01'])), 'lease_overlap', 409);

    expect([E::champs($this->org, $bail), E::lignes($this->org, $bail)])->toBe($avant);
});

it('résilie après le départ du préavis quand le lot reste libre jusque-là', function (): void {
    ['bail' => $bail, 'lot' => $lot] = leaseTacitePartant($this);
    leaseSuivant($this, $lot, '2027-06-01');

    E::resilier($this->org, $bail, E::fin($bail, ['fin' => '2027-06-01']));

    expect(E::champs($this->org, $bail))->toMatchArray(['status' => 'terminated', 'ends_on' => '2027-06-01']);
});

it('résilie après le départ du préavis sans autre bail sur le lot', function (): void {
    ['bail' => $bail] = leaseTacitePartant($this);

    E::resilier($this->org, $bail, E::fin($bail, ['fin' => '2027-06-01']));

    expect(E::champs($this->org, $bail))->toMatchArray(['status' => 'terminated', 'ends_on' => '2027-06-01']);
});

it('refuse un nouveau préavis remplaçant qui repousse le départ sur un lot déjà repris', function (): void {
    ['bail' => $bail, 'lot' => $lot] = leaseTacitePartant($this);
    leaseSuivant($this, $lot, '2027-01-01');
    $avant = [E::champs($this->org, $bail), E::lignes($this->org, $bail)];

    E::refus(fn () => E::poser($this->org, $bail, E::preavis($bail, ['recu' => '2026-11-10', 'depart' => '2027-06-01', 'remplace' => true])), 'lease_overlap', 409);

    expect([E::champs($this->org, $bail), E::lignes($this->org, $bail)])->toBe($avant);
});

it('accepte un préavis remplaçant qui repousse le départ quand le lot est libre, ou qui l\'avance', function (): void {
    ['bail' => $bail, 'lot' => $lot] = leaseTacitePartant($this);
    leaseSuivant($this, $lot, '2027-07-01');

    $apres = E::poser($this->org, $bail, E::preavis($bail, ['recu' => '2026-11-10', 'depart' => '2027-06-01', 'remplace' => true]));

    expect(E::champs($this->org, $bail)['departure_on'])->toBe('2027-06-01');

    E::poser($this->org, $apres, E::preavis($apres, ['recu' => '2026-11-12', 'depart' => '2027-03-01', 'remplace' => true]));

    expect(E::champs($this->org, $bail)['departure_on'])->toBe('2027-03-01');
});

it('exige que la résiliation suive le départ du congé du bailleur, sauf accord amiable', function (): void {
    ['bail' => $bail] = E::bail($this->org, [
        'duration_months' => 12, 'tacit_renewal' => false, 'ends_on' => '2027-01-01',
        'notice_given_by' => NoticeGivenBy::Landlord, 'notice_received_on' => '2026-03-01',
        'notice_departure_on' => '2027-01-01', 'termination_reason' => 'Reprise pour habiter',
    ]);

    E::refus(fn () => E::resilier($this->org, $bail, E::fin($bail, ['fin' => '2026-10-01'])), 'lease_notice_invalid', 422);

    expect(E::champs($this->org, $bail)['status'])->toBe('signed');

    E::resilier($this->org, $bail, E::fin($bail, ['fin' => '2026-10-01', 'amiable' => true, 'motif' => 'Accord des parties']));

    expect(E::champs($this->org, $bail))->toMatchArray(['status' => 'terminated', 'ends_on' => '2026-10-01']);
});

it('accepte la résiliation au départ du congé du bailleur', function (): void {
    ['bail' => $bail] = E::bail($this->org, [
        'duration_months' => 12, 'tacit_renewal' => false, 'ends_on' => '2027-01-01',
        'notice_given_by' => NoticeGivenBy::Landlord, 'notice_received_on' => '2026-03-01',
        'notice_departure_on' => '2027-01-01', 'termination_reason' => 'Reprise pour habiter',
    ]);

    E::resilier($this->org, $bail, E::fin($bail));

    expect(E::champs($this->org, $bail))->toMatchArray(['status' => 'terminated', 'ends_on' => '2027-01-01']);
});
