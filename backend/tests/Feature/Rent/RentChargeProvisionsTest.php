<?php

declare(strict_types=1);

use App\Modules\Accounting\PublicApi\Ledger;
use App\Modules\Organizations\Enums\OrganizationKind;
use App\Modules\Rent\Data\LeaseProvisionsData;
use App\Modules\Rent\PublicApi\ChargeProvisions;
use App\Modules\Rent\Support\IssuerIdentity;
use App\Shared\Tenancy\CurrentOrganization;
use Carbon\CarbonImmutable;
use Illuminate\Support\Str;
use Tests\Feature\Leases\LeasesContext as L;
use Tests\Feature\Mandates\MandatesContext as M;
use Tests\Feature\Rent\RentContext as C;

beforeEach(function (): void {
    C::preparer($this);
    $this->org = C::organisation();
    ['bail' => $this->bail, 'lot' => $this->lot] = C::bail($this->org);
    $this->lire = fn (string $de, string $a, ?array $baux = null): array => L::dans($this->org, fn (): array => app(ChargeProvisions::class)->calledBetween($baux ?? [$this->bail->id], CarbonImmutable::parse($de), CarbonImmutable::parse($a)));
});

it('somme les provisions des échéances émises sur [from, to), jamais le loyer, et ignore une échéance non émise', function (): void {
    C::generer($this->org, $this->bail, '2026-11-25');
    expect(($this->lire)('2026-01-01', '2027-01-01'))->toBe([]);

    $this->actingAs(L::titulaire($this->org));
    $this->travelTo('2026-11-25');
    [$novembre] = C::echeances($this->org, $this->bail);
    $this->postJson(C::url($this->org, "/installments/{$novembre->id}/issue"))->assertOk();

    $lues = ($this->lire)('2026-01-01', '2027-01-01');

    expect($lues)->toHaveCount(1)->and($lues[$this->bail->id])->toBeInstanceOf(LeaseProvisionsData::class)
        ->and($lues[$this->bail->id]->called->getAmount())->toBe('5000')->and($lues[$this->bail->id]->installments)->toBe(1);
});

it('borne la période en semi-ouvert et déduit une échéance annulée', function (): void {
    C::emises($this->org, $this->bail, $this, '2026-11-25');

    expect(($this->lire)('2026-11-01', '2026-12-01')[$this->bail->id]->called->getAmount())->toBe('5000')
        ->and(($this->lire)('2026-11-01', '2027-01-01')[$this->bail->id]->called->getAmount())->toBe('10000')->and(($this->lire)('2026-11-01', '2027-01-01')[$this->bail->id]->installments)->toBe(2)
        ->and(($this->lire)('2026-12-01', '2027-01-01')[$this->bail->id]->called->getAmount())->toBe('5000')
        ->and(($this->lire)('2026-11-02', '2026-12-01'))->toBe([])
        ->and(($this->lire)('2026-11-01', '2027-01-01', []))->toBe([]);

    [, $decembre] = C::echeances($this->org, $this->bail);
    $this->postJson(C::url($this->org, "/installments/{$decembre->id}/cancel"), ['reason' => 'Erreur de saisie'])->assertOk();

    expect(($this->lire)('2026-11-01', '2027-01-01')[$this->bail->id]->called->getAmount())->toBe('5000');
});

it('donne la part non réglée depuis le grand livre, plafonnée aux provisions', function (): void {
    C::emises($this->org, $this->bail, $this, '2026-11-25');
    expect(($this->lire)('2026-11-01', '2027-01-01')[$this->bail->id]->unpaid->getAmount())->toBe('10000');

    C::payer($this, $this->org, $this->bail, 70000)->assertCreated();

    expect(($this->lire)('2026-11-01', '2027-01-01')[$this->bail->id]->unpaid->getAmount())->toBe('5000');
});

it('signale des provisions non routées, puis le mandant unique quand les fonds sont activés', function (): void {
    C::emises($this->org, $this->bail, $this, '2026-11-25');
    $sansRoutage = ($this->lire)('2026-11-01', '2027-01-01')[$this->bail->id];

    expect($sansRoutage->hasUnrouted)->toBeTrue()->and($sansRoutage->mandantPartyIds)->toBe([]);

    $mandant = L::dans($this->org, fn () => M::partie($this->org));
    $mandat = M::actif($this->org, $this->lot, $mandant);
    L::dans($this->org, fn () => app(Ledger::class)->activateOwnerFunds(CarbonImmutable::parse('2026-01-01')));
    $this->travelTo('2026-12-20');
    C::emises($this->org, $this->bail, $this, '2027-01-25');

    $route = ($this->lire)('2027-01-01', '2027-03-01')[$this->bail->id];
    expect($route->hasUnrouted)->toBeFalse()->and($route->mandantPartyIds)->toBe([$mandant->id])->and($route->mandateIds)->toBe([$mandat->id]);
});

it('ne lit pas les provisions d\'un bail d\'une autre organisation', function (): void {
    C::emises($this->org, $this->bail, $this, '2026-11-25');
    app()->forgetInstance(CurrentOrganization::class);
    app()->forgetInstance(IssuerIdentity::class);
    $autre = C::organisation(OrganizationKind::Agency, 'Agence Etrangere');

    $lues = L::dans($autre, fn (): array => app(ChargeProvisions::class)->calledBetween([$this->bail->id, (string) Str::uuid7()], CarbonImmutable::parse('2026-01-01'), CarbonImmutable::parse('2027-01-01')));

    expect($lues)->toBe([]);
});
