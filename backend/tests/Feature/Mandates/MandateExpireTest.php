<?php

declare(strict_types=1);

use App\Modules\Mandates\Actions\ExpireMandates;
use App\Modules\Mandates\Enums\MandateStatus;
use Carbon\CarbonImmutable;
use Tests\Feature\Mandates\MandatesContext as M;

beforeEach(function (): void {
    M::semer();
    $this->org = M::organisation();
    $this->partie = M::partie($this->org);
    $this->travelTo(CarbonImmutable::parse('2029-01-02 03:55:00'));
});

it('fait expirer un mandat échu sans reconduction et laisse en cours les mandats non échus', function (): void {
    $echu = M::actif($this->org, M::lot($this->org), $this->partie, ['ends_on' => '2029-01-01']);
    $suspendu = M::mandat($this->org, M::lot($this->org), $this->partie, ['ends_on' => '2029-01-02'], MandateStatus::Suspended);
    $enCours = M::actif($this->org, M::lot($this->org), $this->partie, ['ends_on' => '2029-01-03']);
    $brouillon = M::mandat($this->org, M::lot($this->org), $this->partie, ['ends_on' => '2028-12-01']);

    $this->artisan('mandates:expire')->expectsOutput('0 mandat(s) reconduit(s), 2 expiré(s).')->assertSuccessful();

    expect(M::relire($this->org, $echu)->status)->toBe(MandateStatus::Expired)
        ->and(M::relire($this->org, $echu)->lock_version)->toBe(2)
        ->and(M::relire($this->org, $suspendu)->status)->toBe(MandateStatus::Expired)
        ->and(M::relire($this->org, $enCours)->status)->toBe(MandateStatus::Active)
        ->and(M::relire($this->org, $brouillon)->status)->toBe(MandateStatus::Draft);
});

it('reconduit un mandat à reconduction tacite jusqu\'à une fin future', function (): void {
    $tacite = M::actif($this->org, M::lot($this->org), $this->partie, ['ends_on' => '2027-01-01', 'tacit_renewal' => true, 'renewal_months' => 12]);

    $bilan = app(ExpireMandates::class)->handle(CarbonImmutable::today());

    $relu = M::relire($this->org, $tacite);
    expect($bilan)->toBe(['renewed' => 1, 'expired' => 0])
        ->and($relu->status)->toBe(MandateStatus::Active)
        ->and($relu->ends_on->toDateString())->toBe('2030-01-01');
});

it('fait expirer une reconduction tacite qui chevaucherait le mandat suivant du lot', function (): void {
    $lot = M::lot($this->org);
    $tacite = M::actif($this->org, $lot, $this->partie, ['ends_on' => '2029-01-01', 'tacit_renewal' => true]);
    $suivant = M::actif($this->org, $lot, M::partie($this->org), ['starts_on' => '2029-01-01', 'ends_on' => '2031-01-01']);

    $bilan = app(ExpireMandates::class)->handle(CarbonImmutable::today());

    expect($bilan)->toBe(['renewed' => 0, 'expired' => 1])
        ->and(M::relire($this->org, $tacite)->status)->toBe(MandateStatus::Expired)
        ->and(M::relire($this->org, $tacite)->ends_on->toDateString())->toBe('2029-01-01')
        ->and(M::relire($this->org, $suivant)->status)->toBe(MandateStatus::Active);
});

it('traite chaque organisation sous son contexte et se rejoue sans effet', function (): void {
    $autre = M::organisation();
    $mien = M::actif($this->org, M::lot($this->org), $this->partie, ['ends_on' => '2029-01-01']);
    $leur = M::actif($autre, M::lot($autre), M::partie($autre), ['ends_on' => '2029-01-01', 'tacit_renewal' => true]);

    expect(app(ExpireMandates::class)->handle(CarbonImmutable::today()))->toBe(['renewed' => 1, 'expired' => 1])
        ->and(app(ExpireMandates::class)->handle(CarbonImmutable::today()))->toBe(['renewed' => 0, 'expired' => 0])
        ->and(M::relire($this->org, $mien)->status)->toBe(MandateStatus::Expired)
        ->and(M::relire($autre, $leur)->status)->toBe(MandateStatus::Active);
});
