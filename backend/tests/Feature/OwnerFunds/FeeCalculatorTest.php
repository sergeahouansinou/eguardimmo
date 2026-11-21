<?php

declare(strict_types=1);

use App\Modules\Mandates\Data\MandateFeeTermData;
use App\Modules\Mandates\Enums\FeeBase;
use App\Modules\Mandates\Enums\FeeKind;
use App\Modules\Mandates\Enums\FeeTaxMode;
use App\Modules\OwnerFunds\Data\FeeSegmentData;
use App\Modules\OwnerFunds\Support\FeeCalculator;
use App\Shared\Http\ApiProblem;
use Money\Currency;

function bareme(string $id = 't1', FeeKind $genre = FeeKind::Percentage, ?int $bp = 700, ?int $forfait = null, ?FeeBase $base = FeeBase::Rent, int $minimum = 0, FeeTaxMode $mode = FeeTaxMode::ExclTax): MandateFeeTermData
{
    return new MandateFeeTermData($id, '2026-01-01', null, $genre, $bp, $forfait, $base, $minimum, $mode);
}

function calcul(array $segments, int $taux = 20000): array
{
    $r = (new FeeCalculator)->compute($segments, $taux, new Currency('EUR'));

    return [$r->net, $r->tax, $r->gross, $r->minimumApplied];
}

it('pourcentage sur le loyer seul, TVA à 20 % en plus', function (): void {
    expect(calcul([new FeeSegmentData(bareme(), 100000, 10000)]))->toBe([7000, 1400, 8400, false]);
});

it('base loyer et charges', function (): void {
    expect(calcul([new FeeSegmentData(bareme(base: FeeBase::RentAndCharges), 100000, 10000)]))->toBe([7700, 1540, 9240, false]);
});

it('arrondit au demi supérieur', function (): void {
    expect(calcul([new FeeSegmentData(bareme(bp: 750), 10001, 0)], 0))->toBe([750, 0, 750, false]);
});

it('le demi exact et la fraction supérieure à un demi montent à l\'unité supérieure', function (): void {
    expect(calcul([new FeeSegmentData(bareme(bp: 500), 50, 0)], 0))->toBe([3, 0, 3, false])
        ->and(calcul([new FeeSegmentData(bareme(bp: 750), 10010, 0)], 0))->toBe([751, 0, 751, false]);
});

it('forfait mensuel dû si la base est positive, nul sinon', function (): void {
    $f = bareme(genre: FeeKind::Flat, bp: null, forfait: 5000);

    expect(calcul([new FeeSegmentData($f, 1, 0)]))->toBe([5000, 1000, 6000, false])
        ->and(calcul([new FeeSegmentData($f, 0, 0)]))->toBe([0, 0, 0, false]);
});

it('minimum appliqué quand les honoraires sont positifs mais inférieurs', function (): void {
    expect(calcul([new FeeSegmentData(bareme(minimum: 3000), 10000, 0)]))->toBe([3000, 600, 3600, true])
        ->and(calcul([new FeeSegmentData(bareme(minimum: 3000), 0, 0)]))->toBe([0, 0, 0, false]);
});

it('TTC : le calcul donne le TTC, le HT en est déduit', function (): void {
    expect(calcul([new FeeSegmentData(bareme(mode: FeeTaxMode::InclTax), 100000, 0)]))->toBe([5833, 1167, 7000, false]);
});

it('avenant en cours de mois : chaque segment au taux de son barème, minimum et mode du dernier', function (): void {
    $a = bareme('a', bp: 500);
    $b = bareme('b', bp: 1000, minimum: 0);

    expect(calcul([new FeeSegmentData($a, 40000, 0), new FeeSegmentData($b, 60000, 0)]))->toBe([8000, 1600, 9600, false]);
});

it('mois négatif : honoraires négatifs, jamais de minimum', function (): void {
    expect(calcul([new FeeSegmentData(bareme(minimum: 3000), -10000, 0)]))->toBe([-700, -140, -840, false]);
});

it('refuse le calcul quand la base du barème est absente', function (): void {
    expect(fn () => calcul([new FeeSegmentData(bareme(base: null), 100000, 0)]))->toThrow(ApiProblem::class);
});

it('sans encaissement, aucune base n\'est exigée', function (): void {
    expect(calcul([new FeeSegmentData(bareme(base: null), 0, 0)]))->toBe([0, 0, 0, false]);
});

it('en franc CFA (sans décimale) arrondit au franc, au demi supérieur', function (int $assiette, int $bp, int $attendu): void {
    $r = (new FeeCalculator)->compute([new FeeSegmentData(bareme(bp: $bp), $assiette, 0)], 0, new Currency('XOF'));

    expect($r->net)->toBe($attendu)->and($r->gross)->toBe($attendu);
})->with([
    '1 point de base sur 65 000 : 6,5 devient 7' => [65000, 1, 7],
    '5 points de base sur 65 000 : 32,5 devient 33' => [65000, 5, 33],
    '10 % sur 250 005 : 25 000,5 devient 25 001' => [250005, 1000, 25001],
]);
