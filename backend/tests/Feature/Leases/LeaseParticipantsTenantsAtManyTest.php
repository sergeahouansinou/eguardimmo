<?php

declare(strict_types=1);

use App\Modules\Leases\PublicApi\LeaseParticipants;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\Feature\Leases\LeasesContext as L;
use Tests\Feature\Rent\RentContext as C;

beforeEach(function (): void {
    C::preparer($this);
    $this->org = C::organisation();
});

it('tenantsAtMany rend les locataires de plusieurs baux en une requête, comme tenantsAt', function (): void {
    ['bail' => $a] = C::bail($this->org);
    ['bail' => $b] = C::bail($this->org);
    $jour = CarbonImmutable::parse('2026-11-30');

    $resultat = L::dans($this->org, fn () => app(LeaseParticipants::class)->tenantsAtMany([$a->id, $b->id, $a->id], $jour));
    $unitaire = L::dans($this->org, fn () => app(LeaseParticipants::class)->tenantsAt($a->id, $jour));

    expect(array_keys($resultat))->toEqualCanonicalizing([$a->id, $b->id])
        ->and($resultat[$a->id])->toHaveCount(1)
        ->and($resultat[$a->id][0]->partyId)->toBe($unitaire[0]->partyId);

    DB::flushQueryLog();
    DB::enableQueryLog();
    L::dans($this->org, fn () => app(LeaseParticipants::class)->tenantsAtMany([$a->id, $b->id], $jour));
    expect(count(DB::getQueryLog()))->toBe(1);
    DB::disableQueryLog();
});

it('tenantsAtMany ignore un bail avant son début, un bail inconnu ou d\'une autre organisation', function (): void {
    ['bail' => $mien] = C::bail($this->org);
    $autre = C::organisation(nom: 'Autre agence');
    ['bail' => $etranger] = C::bail($autre);

    $avant = L::dans($this->org, fn () => app(LeaseParticipants::class)->tenantsAtMany([$mien->id], CarbonImmutable::parse('2000-01-01')));
    $croise = L::dans($this->org, fn () => app(LeaseParticipants::class)->tenantsAtMany([$mien->id, $etranger->id, (string) Str::uuid()], CarbonImmutable::parse('2026-11-30')));

    expect($avant)->toBe([])->and(array_keys($croise))->toBe([$mien->id]);
    expect(L::dans($this->org, fn () => app(LeaseParticipants::class)->tenantsAtMany([], CarbonImmutable::parse('2026-11-30'))))->toBe([]);
});
