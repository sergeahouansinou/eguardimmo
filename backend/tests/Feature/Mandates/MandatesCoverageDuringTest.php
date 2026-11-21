<?php

declare(strict_types=1);

use App\Modules\Mandates\Models\MandateUnit;
use App\Modules\Mandates\PublicApi\MandateDirectory;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Tests\Feature\Mandates\MandatesContext as M;

beforeEach(function (): void {
    M::semer();
    $this->org = M::organisation();
    $this->lot = M::lot($this->org);
    $this->partie = M::partie($this->org);
    $this->couverture = fn (string $de, string $a, ?array $mandants = null) => M::dans($this->org, fn () => app(MandateDirectory::class)->coverageDuring(CarbonImmutable::parse($de), CarbonImmutable::parse($a), $mandants));
});

it('renvoie une ligne par mandat et par lot avec les bornes de couverture incluses', function (): void {
    $mandat = M::actif($this->org, $this->lot, $this->partie, ['starts_on' => '2026-03-15', 'ends_on' => '2026-11-10']);

    $spans = ($this->couverture)('2026-03-01', '2026-12-31');

    expect($spans)->toHaveCount(1)
        ->and($spans[0]->mandateId)->toBe($mandat->id)
        ->and($spans[0]->from)->toBe('2026-03-15')
        ->and($spans[0]->to)->toBe('2026-11-09')
        ->and($spans[0]->mandantPartyId)->toBe($this->partie->id)
        ->and($spans[0]->feeBasisPoints)->toBe(700);
});

it('ignore un brouillon, un mandat hors période et un autre mandant', function (): void {
    M::mandat($this->org, $this->lot, $this->partie, ['starts_on' => '2026-01-01', 'ends_on' => '2027-01-01']);
    $autreLot = M::lot($this->org);
    $autre = M::partie($this->org);
    M::actif($this->org, $autreLot, $autre, ['starts_on' => '2026-01-01', 'ends_on' => '2027-01-01']);

    expect(($this->couverture)('2026-05-01', '2026-05-31'))->toHaveCount(1)
        ->and(($this->couverture)('2026-05-01', '2026-05-31', [$this->partie->id]))->toBe([])
        ->and(($this->couverture)('2025-05-01', '2025-05-31'))->toBe([])
        ->and(($this->couverture)('2027-01-01', '2027-01-31'))->toBe([]);
});

it('coupe un lot sorti en cours de période et prend les conditions du dernier jour couvert', function (): void {
    $mandat = M::actif($this->org, $this->lot, $this->partie, ['starts_on' => '2026-01-01', 'ends_on' => '2027-01-01']);
    M::dans($this->org, fn () => MandateUnit::query()->where('mandate_id', $mandat->id)->get()->each(fn (MandateUnit $l) => $l->forceFill(['valid_to' => '2026-05-11'])->save()));

    $spans = ($this->couverture)('2026-05-01', '2026-05-31');

    expect($spans)->toHaveCount(1)->and($spans[0]->to)->toBe('2026-05-10');
});

it('lit le même nombre de requêtes quel que soit le nombre de mandants', function (): void {
    $mesure = function (): int {
        DB::flushQueryLog();
        DB::enableQueryLog();
        ($this->couverture)('2026-05-01', '2026-05-31');
        $n = count(DB::getQueryLog());
        DB::disableQueryLog();

        return $n;
    };
    M::actif($this->org, $this->lot, $this->partie, ['starts_on' => '2026-01-01', 'ends_on' => '2027-01-01']);
    $mesure();
    $avant = $mesure();

    foreach (range(1, 4) as $i) {
        M::actif($this->org, M::lot($this->org), M::partie($this->org), ['starts_on' => '2026-01-01', 'ends_on' => '2027-01-01']);
    }

    expect($mesure())->toBe($avant);
});

it('ne voit pas les mandats d\'une autre organisation', function (): void {
    M::actif($this->org, $this->lot, $this->partie, ['starts_on' => '2026-01-01', 'ends_on' => '2027-01-01']);
    $autre = M::organisation();

    expect(M::dans($autre, fn () => app(MandateDirectory::class)->coverageDuring(CarbonImmutable::parse('2026-05-01'), CarbonImmutable::parse('2026-05-31'))))->toBe([]);
});
