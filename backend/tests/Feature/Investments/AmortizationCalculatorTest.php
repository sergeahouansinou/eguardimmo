<?php

declare(strict_types=1);

use App\Modules\Investments\Data\LoanTermsData;
use App\Modules\Investments\Data\ScheduleRowData;
use App\Modules\Investments\Enums\DeferralKind;
use App\Modules\Investments\Enums\InsuranceMode;
use App\Modules\Investments\Support\AmortizationCalculator;

// Valeurs de référence calculées à part (Python, Decimal, demi supérieur), jamais par le code testé.

function termes(int $capital, string $taux, int $mois, array $surcharges = []): LoanTermsData
{
    return new LoanTermsData(
        $capital, $taux, $surcharges['premiere'] ?? '2026-01-05', $mois, $surcharges['differe'] ?? DeferralKind::None, $surcharges['moisDiffere'] ?? 0,
        $surcharges['assurance'] ?? InsuranceMode::None, $surcharges['tauxAssurance'] ?? null, $surcharges['montantAssurance'] ?? null,
    );
}

/**
 * @return array{int, int, int, int}
 */
function ligneEcheance(ScheduleRowData $r): array
{
    return [$r->payment, $r->interest, $r->principal, $r->outstandingAfter];
}

beforeEach(function (): void {
    $this->calc = new AmortizationCalculator;
});

it('12 000,00 EUR à 12 % sur 12 mois : mensualité 1 066,19, première, deuxième et dernière échéance de référence', function (): void {
    $lignes = $this->calc->compute(termes(1200000, '12', 12));

    expect(ligneEcheance($lignes[0]))->toBe([106619, 12000, 94619, 1105381])
        ->and(ligneEcheance($lignes[1]))->toBe([106619, 11054, 95565, 1009816])
        ->and(ligneEcheance($lignes[11]))->toBe([106614, 1056, 105558, 0])
        ->and(array_sum(array_map(fn (ScheduleRowData $r): int => $r->principal, $lignes)))->toBe(1200000)
        ->and($lignes[0]->dueOn)->toBe('2026-01-05')->and($lignes[11]->dueOn)->toBe('2026-12-05');
});

it('prêt à taux zéro : capital réparti, la dernière échéance absorbe l\'arrondi, aucun intérêt', function (): void {
    $lignes = $this->calc->compute(termes(100000, '0', 3));

    expect(array_map(ligneEcheance(...), $lignes))->toBe([[33333, 0, 33333, 66667], [33333, 0, 33333, 33334], [33334, 0, 33334, 0]]);
});

it('300 mois à 3,5 % : somme du capital exacte, restant dû nul, référence indépendante et formule fermée', function (): void {
    $lignes = $this->calc->compute(termes(20000000, '3.5', 300));
    $r = 0.035 / 12;
    $fermee = 20000000 * $r / (1 - (1 + $r) ** -300);

    expect(ligneEcheance($lignes[0]))->toBe([100125, 58333, 41792, 19958208])
        ->and(ligneEcheance($lignes[1]))->toBe([100125, 58211, 41914, 19916294])
        ->and(ligneEcheance($lignes[299]))->toBe([99984, 291, 99693, 0])
        ->and(array_sum(array_map(fn (ScheduleRowData $x): int => $x->interest, $lignes)))->toBe(10037359)
        ->and(array_sum(array_map(fn (ScheduleRowData $x): int => $x->principal, $lignes)))->toBe(20000000)
        ->and(abs($lignes[0]->payment - $fermee))->toBeLessThan(1.0)
        ->and(count($lignes))->toBe(300);
});

it('le calcul est invariant : jamais de restant dû négatif et chaînage exact sur toutes les échéances', function (): void {
    foreach ([['7', 17], ['0.1', 240], ['9.99999', 600], ['0', 600], ['30', 1]] as [$taux, $mois]) {
        $restant = 7654321;

        foreach ($this->calc->compute(termes($restant, $taux, $mois)) as $l) {
            expect($l->outstandingAfter)->toBe($restant - $l->principal)->and($l->outstandingAfter)->toBeGreaterThanOrEqual(0)->and($l->payment)->toBe($l->interest + $l->principal);
            $restant = $l->outstandingAfter;
        }

        expect($restant)->toBe(0);
    }
});

it('différé partiel : intérêts seuls pendant trois mois puis amortissement sur neuf', function (): void {
    $lignes = $this->calc->compute(termes(1000000, '6', 12, ['differe' => DeferralKind::Partial, 'moisDiffere' => 3]));

    expect(array_map(ligneEcheance(...), array_slice($lignes, 0, 5)))->toBe([[5000, 5000, 0, 1000000], [5000, 5000, 0, 1000000], [5000, 5000, 0, 1000000], [113907, 5000, 108907, 891093], [113907, 4455, 109452, 781641]])
        ->and(ligneEcheance($lignes[11]))->toBe([113910, 567, 113343, 0]);
});

it('différé total : intérêts capitalisés, aucune mensualité, le capital remboursé couvre capital et intérêts capitalisés', function (): void {
    $lignes = $this->calc->compute(termes(1000000, '6', 12, ['differe' => DeferralKind::Total, 'moisDiffere' => 3]));

    expect(array_map(ligneEcheance(...), array_slice($lignes, 0, 5)))->toBe([[0, 5000, 0, 1005000], [0, 5025, 0, 1010025], [0, 5050, 0, 1015075], [115625, 5075, 110550, 904525], [115625, 4523, 111102, 793423]])
        ->and(ligneEcheance($lignes[11]))->toBe([115621, 575, 115046, 0])
        ->and(array_sum(array_map(fn (ScheduleRowData $x): int => $x->principal, $lignes)))->toBe(1015075);
});

it('assurance : capital initial constant, capital restant dû dégressif, montant fixe', function (): void {
    $initial = $this->calc->compute(termes(1200000, '12', 12, ['assurance' => InsuranceMode::InitialCapital, 'tauxAssurance' => '0.36']));
    $restant = $this->calc->compute(termes(1200000, '12', 12, ['assurance' => InsuranceMode::OutstandingCapital, 'tauxAssurance' => '0.36']));
    $fixe = $this->calc->compute(termes(1200000, '12', 12, ['assurance' => InsuranceMode::Fixed, 'montantAssurance' => 1500]));

    expect(array_unique(array_map(fn (ScheduleRowData $r): int => $r->insurance, $initial)))->toBe([360])
        ->and([$restant[0]->insurance, $restant[1]->insurance, $restant[2]->insurance])->toBe([360, 332, 303])
        ->and(array_unique(array_map(fn (ScheduleRowData $r): int => $r->insurance, $fixe)))->toBe([1500])
        ->and($initial[0]->payment)->toBe(106619);
});

it('XOF sans décimale : même calcul, l\'unité mineure est l\'unité', function (): void {
    $lignes = $this->calc->compute(termes(5000000, '8', 24));

    expect(ligneEcheance($lignes[0]))->toBe([226136, 33333, 192803, 4807197])->and(ligneEcheance($lignes[23]))->toBe([226148, 1498, 224650, 0]);
});

it('arrondi des intérêts au demi supérieur : 0,5 devient 1, jamais 0', function (): void {
    $lignes = $this->calc->compute(termes(100, '6', 1));

    expect(ligneEcheance($lignes[0]))->toBe([101, 1, 100, 0]);
});

it('un intérêt exactement égal à 0,5 s\'arrondit vers le haut même quand le taux périodique ne tombe pas juste (8 % : 75 / 150)', function (): void {
    $lignes = $this->calc->compute(termes(75, '8', 1));

    expect(ligneEcheance($lignes[0]))->toBe([76, 1, 75, 0]);
});

it('dates mensuelles : fin de mois et année bissextile suivies sans dérive', function (): void {
    $bissextile = $this->calc->compute(termes(300000, '0', 4, ['premiere' => '2024-01-31']));
    $normale = $this->calc->compute(termes(300000, '0', 3, ['premiere' => '2025-01-31']));

    expect(array_map(fn (ScheduleRowData $r): string => $r->dueOn, $bissextile))->toBe(['2024-01-31', '2024-02-29', '2024-03-31', '2024-04-30'])
        ->and(array_map(fn (ScheduleRowData $r): string => $r->dueOn, $normale))->toBe(['2025-01-31', '2025-02-28', '2025-03-31']);
});

it('remboursement anticipé : durée réduite ou mensualité réduite, références calculées à part', function (): void {
    $lignes = $this->calc->compute(termes(1200000, '12', 12));
    $apres = $lignes[3]->outstandingAfter - 200000;

    $duree = $this->calc->continue(termes(1200000, '12', 12), $apres, 4, 8, $lignes[4]->payment);
    $mensualite = $this->calc->continue(termes(1200000, '12', 12), $apres, 4, 8, null);

    expect(count($duree))->toBe(6)->and(ligneEcheance($duree[0]))->toBe([106619, 6158, 100461, 515348])->and(ligneEcheance($duree[5]))->toBe([104391, 1034, 103357, 0])
        ->and(count($mensualite))->toBe(8)->and(ligneEcheance($mensualite[0]))->toBe([80480, 6158, 74322, 541487])->and(ligneEcheance($mensualite[7]))->toBe([80482, 797, 79685, 0]);
});
