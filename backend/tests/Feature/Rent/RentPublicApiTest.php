<?php

declare(strict_types=1);

use App\Modules\Rent\PublicApi\RentLedger;
use App\Shared\Http\ApiProblem;
use App\Shared\Tenancy\CurrentOrganization;
use App\Shared\Tenancy\MissingOrganizationContext;
use Carbon\CarbonImmutable;
use Tests\Feature\Leases\LeasesContext as L;
use Tests\Feature\Rent\RentContext as C;

beforeEach(function (): void {
    C::preparer($this);
    $this->org = C::organisation();
    ['bail' => $this->bail] = C::bail($this->org);
    C::emises($this->org, $this->bail, $this);
});

it('donne le solde d\'un bail depuis le grand livre : dû, retard, avance', function (): void {
    C::payer($this, $this->org, $this->bail, 25000)->assertCreated();

    $solde = L::dans($this->org, fn () => app(RentLedger::class)->leaseBalance($this->bail->id));

    expect($solde->balance->getAmount())->toBe('45000')
        ->and($solde->overdue->getAmount())->toBe('45000')
        ->and($solde->advance->getAmount())->toBe('0')
        ->and($solde->unpaidCount)->toBe(1)
        ->and($solde->oldestUnpaidDueDate)->toBe('2026-11-05');
});

it('l\'échéance non échue n\'est pas en retard', function (): void {
    $solde = L::dans($this->org, fn () => app(RentLedger::class)->leaseBalance($this->bail->id, CarbonImmutable::parse('2026-11-05')));

    expect($solde->balance->getAmount())->toBe('70000')->and($solde->overdue->getAmount())->toBe('0');
});

it('liste les échéances impayées échues avec leur reste dû, par identifiant croissant', function (): void {
    C::payer($this, $this->org, $this->bail, 25000)->assertCreated();

    $impayes = L::dans($this->org, fn () => app(RentLedger::class)->unpaidInstallments());

    expect($impayes)->toHaveCount(1)
        ->and($impayes[0]->leaseId)->toBe($this->bail->id)
        ->and($impayes[0]->outstanding->getAmount())->toBe('45000')
        ->and(L::dans($this->org, fn () => app(RentLedger::class)->unpaidInstallments(CarbonImmutable::parse('2026-11-05'))))->toBe([]);
});

it('un bail soldé n\'est plus dans les impayés, le solde d\'un bail étranger est refusé', function (): void {
    C::payer($this, $this->org, $this->bail, 70000)->assertCreated();
    $autre = C::organisation(nom: 'Autre');
    ['bail' => $etranger] = C::bail($autre);

    expect(L::dans($this->org, fn () => app(RentLedger::class)->unpaidInstallments()))->toBe([]);
    expect(fn () => L::dans($this->org, fn () => app(RentLedger::class)->leaseBalance($etranger->id)))->toThrow(ApiProblem::class);
});

it('exige un contexte d\'organisation', function (): void {
    app()->forgetInstance(CurrentOrganization::class);

    expect(fn () => app(RentLedger::class)->unpaidInstallments())->toThrow(MissingOrganizationContext::class);
});
