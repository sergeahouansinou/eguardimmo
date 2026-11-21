<?php

declare(strict_types=1);

use App\Modules\Mandates\Enums\FeeKind;
use App\Modules\Mandates\Enums\MandateStatus;
use App\Modules\Mandates\PublicApi\MandateDirectory;
use App\Shared\Http\ApiProblem;
use App\Shared\Tenancy\MissingOrganizationContext;
use Carbon\CarbonImmutable;
use Illuminate\Support\Str;
use Tests\Feature\Mandates\MandatesContext as M;

beforeEach(function (): void {
    M::semer();
    $this->org = M::organisation();
    $this->lot = M::lot($this->org);
    $this->partie = M::partie($this->org);
    $this->annuaire = fn (callable $appel) => M::dans($this->org, fn () => $appel(app(MandateDirectory::class)));
});

it('trouve le mandat actif qui couvre un lot à une date, avec les conditions du jour', function (): void {
    $mandat = M::actif($this->org, $this->lot, $this->partie, ['starts_on' => '2026-01-01', 'ends_on' => '2027-01-01']);

    $couverture = ($this->annuaire)(fn (MandateDirectory $d) => $d->coveringUnit($this->lot->id, CarbonImmutable::parse('2026-06-15')));

    expect($couverture)->not->toBeNull()
        ->and($couverture->mandateId)->toBe($mandat->id)
        ->and($couverture->reference)->toBe($mandat->reference)
        ->and($couverture->mandantPartyId)->toBe($this->partie->id)
        ->and($couverture->status)->toBe(MandateStatus::Active)
        ->and($couverture->isSuspended)->toBeFalse()
        ->and($couverture->startsOn)->toBe('2026-01-01')
        ->and($couverture->endDate)->toBe('2026-12-31')
        ->and($couverture->feeKind)->toBe(FeeKind::Percentage)
        ->and($couverture->feeBasisPoints)->toBe(700)
        ->and($couverture->feeFlatAmount)->toBeNull()
        ->and($couverture->currency)->toBe('EUR')
        ->and($couverture->payoutDay)->toBe(5)
        ->and($couverture->worksLimitAmount)->toBe(50000);
});

it('respecte les bornes semi-ouvertes : couvert le premier jour et le dernier, plus le lendemain', function (): void {
    M::actif($this->org, $this->lot, $this->partie, ['starts_on' => '2026-01-01', 'ends_on' => '2027-01-01']);
    $a = fn (string $jour) => ($this->annuaire)(fn (MandateDirectory $d) => $d->coveringUnit($this->lot->id, CarbonImmutable::parse($jour)));

    expect($a('2025-12-31'))->toBeNull()
        ->and($a('2026-01-01'))->not->toBeNull()
        ->and($a('2026-12-31'))->not->toBeNull()
        ->and($a('2027-01-01'))->toBeNull();
});

it('ne voit pas un brouillon, signale un mandat suspendu et suit le lot qui sort du mandat', function (): void {
    M::mandat($this->org, $this->lot, $this->partie);
    $date = CarbonImmutable::parse('2026-06-15');

    expect(($this->annuaire)(fn (MandateDirectory $d) => $d->coveringUnit($this->lot->id, $date)))->toBeNull();

    $suspendu = M::mandat($this->org, $autreLot = M::lot($this->org), $this->partie, [], MandateStatus::Suspended);
    $couverture = ($this->annuaire)(fn (MandateDirectory $d) => $d->coveringUnit($autreLot->id, $date));

    expect($couverture?->isSuspended)->toBeTrue()->and($couverture?->mandateId)->toBe($suspendu->id);

    M::dans($this->org, fn () => $suspendu->units()->update(['valid_to' => '2026-06-01']));
    expect(($this->annuaire)(fn (MandateDirectory $d) => $d->coveringUnit($autreLot->id, $date)))->toBeNull();
});

it('renvoie les conditions en vigueur à la date demandée après un avenant', function (): void {
    $mandat = M::actif($this->org, $this->lot, $this->partie);
    M::dans($this->org, function () use ($mandat): void {
        $mandat->terms()->update(['valid_to' => '2026-07-01']);
        $mandat->terms()->create(['fee_kind' => 'percentage', 'fee_basis_points' => 500, 'currency' => 'EUR', 'payout_day' => 9,
            'works_limit_amount' => Money\Money::EUR(0), 'valid_from' => '2026-07-01', 'reason' => 'amendment']);
    });

    $avant = ($this->annuaire)(fn (MandateDirectory $d) => $d->coveringUnit($this->lot->id, CarbonImmutable::parse('2026-06-30')));
    $apres = ($this->annuaire)(fn (MandateDirectory $d) => $d->coveringUnit($this->lot->id, CarbonImmutable::parse('2026-07-01')));

    expect($avant?->feeBasisPoints)->toBe(700)->and($apres?->feeBasisPoints)->toBe(500)->and($apres?->payoutDay)->toBe(9);
});

it('résout plusieurs lots en un appel, sans les lots non couverts ni ceux d\'une autre organisation', function (): void {
    $autre = M::organisation();
    $libre = M::lot($this->org);
    $mandat = M::actif($this->org, $this->lot, $this->partie);
    M::actif($autre, $etranger = M::lot($autre), M::partie($autre));

    $resultat = ($this->annuaire)(fn (MandateDirectory $d) => $d->coveringUnits([$this->lot->id, $libre->id, $etranger->id], CarbonImmutable::parse('2026-06-15')));

    expect(array_keys($resultat))->toBe([$this->lot->id])->and($resultat[$this->lot->id]->mandateId)->toBe($mandat->id)
        ->and(($this->annuaire)(fn (MandateDirectory $d) => $d->coveringUnits([], CarbonImmutable::parse('2026-06-15'))))->toBe([]);
});

it('lit un mandat ou plusieurs, et lève mandate_not_found hors de l\'organisation', function (): void {
    $mandat = M::actif($this->org, $this->lot, $this->partie, ['starts_on' => '2026-01-01', 'ends_on' => '2027-01-01']);
    $autre = M::organisation();
    $etranger = M::actif($autre, M::lot($autre), M::partie($autre));

    $donnee = ($this->annuaire)(fn (MandateDirectory $d) => $d->find($mandat->id));
    $plusieurs = ($this->annuaire)(fn (MandateDirectory $d) => $d->findMany([$mandat->id, $mandat->id]));

    expect($donnee->reference)->toBe($mandat->reference)->and($donnee->endDate)->toBe('2026-12-31')->and($donnee->unitIds)->toBe([$this->lot->id])
        ->and(array_keys($plusieurs))->toBe([$mandat->id]);

    foreach ([fn (MandateDirectory $d) => $d->find($etranger->id), fn (MandateDirectory $d) => $d->findMany([$mandat->id, $etranger->id]), fn (MandateDirectory $d) => $d->find('pas-un-uuid')] as $appel) {
        expect(fn () => ($this->annuaire)($appel))->toThrow(fn (ApiProblem $e) => $e->problemCode === 'mandate_not_found');
    }
});

it('liste les mandants de l\'organisation courante', function (): void {
    M::actif($this->org, $this->lot, $this->partie);
    $autre = M::organisation();
    M::actif($autre, M::lot($autre), M::partie($autre));

    $mandants = ($this->annuaire)(fn (MandateDirectory $d) => $d->mandants());

    expect($mandants)->toHaveCount(1)->and($mandants[0]->partyId)->toBe($this->partie->id)->and($mandants[0]->runningMandateCount)->toBe(1);
});

it('exige un contexte d\'organisation', function (): void {
    expect(fn () => app(MandateDirectory::class)->find((string) Str::uuid7()))->toThrow(MissingOrganizationContext::class);
});
