<?php

declare(strict_types=1);

use App\Modules\Reporting\Data\ForecastAssumptionsData;
use App\Modules\Reporting\Support\Finance\Amounts;
use App\Modules\Reporting\Support\Finance\Months;
use Carbon\CarbonImmutable;

it('divise au demi supérieur, vers +l\'infini à égalité, pour les nombres négatifs comme positifs', function (int $numerateur, int $diviseur, int $attendu): void {
    expect(Amounts::divide($numerateur, $diviseur))->toBe($attendu);
})->with([
    'positif juste sous la moitié' => [4, 10, 0],
    'positif à égalité' => [5, 2, 3],
    'positif au-dessus' => [7, 3, 2],
    'zéro' => [0, 7, 0],
    'négatif à égalité vers zéro' => [-1, 2, 0],
    'négatif -1,5' => [-3, 2, -1],
    'négatif -0,33' => [-1, 3, 0],
    'négatif -0,67' => [-2, 3, -1],
    'négatif -537,66' => [-591430000, 1100000, -538],
    'grand numérateur' => [27857 * 10000, 1100000, 253],
]);

it('rendement en points de base : numérateur multiplié par 10000 avant la division entière', function (): void {
    expect(Amounts::basisPoints(15857, 1100000))->toBe(144)->and(Amounts::basisPoints(50, 100))->toBe(5000)->and(Amounts::basisPoints(1, 20000))->toBe(1);
});

it('un taux décimal se convertit en millièmes de pour cent sans nombre à virgule, et inversement', function (string $texte, int $milli, string $retour): void {
    expect(ForecastAssumptionsData::milli($texte))->toBe($milli)->and(ForecastAssumptionsData::decimal($milli))->toBe($retour);
})->with([['0', 0, '0.000'], ['3.2', 3200, '3.200'], ['3.200', 3200, '3.200'], ['10', 10000, '10.000'], ['0.005', 5, '0.005'], ['9.99', 9990, '9.990']]);

it('les mois d\'une fenêtre semi-ouverte : du premier au dernier mois touché', function (): void {
    expect(Months::between(CarbonImmutable::parse('2025-04-17'), CarbonImmutable::parse('2025-07-01')))->toBe(['2025-04', '2025-05', '2025-06'])
        ->and(Months::between(CarbonImmutable::parse('2025-12-31'), CarbonImmutable::parse('2026-01-01')))->toBe(['2025-12']);
});
