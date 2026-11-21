<?php

declare(strict_types=1);

use App\Modules\Tax\Data\FactEntryData as F;
use App\Modules\Tax\Data\IncomeFacts;
use App\Modules\Tax\Data\RentalIncomeData;
use App\Modules\Tax\Jurisdictions\Fr\FrRentalIncomeRules;
use App\Modules\Tax\Support\RentalIncomeCalculator;
use App\Modules\Tax\Support\Rounding;

// Valeurs de référence faites à la main ; les points fiscaux à valider par l'expert-comptable (ADR 0039, amendement du 2026-11-21, points 11 à 15) ne sont pas tranchés ici.
function calculer(IncomeFacts $faits, bool $foyer = false, int $max = 200): RentalIncomeData
{
    $regles = new FrRentalIncomeRules;

    return (new RentalIncomeCalculator($max))->compute($regles->form($regles->supportedYears()[0]) ?? throw new LogicException('Millésime absent'), $faits, false, $foyer);
}

/**
 * @return array<string, array{int, int}> code => [exact, arrondi]
 */
function lignesDuBien(RentalIncomeData $r, string $bien): array
{
    $sortie = [];

    foreach ($r->properties as $p) {
        if ($p->propertyId === $bien) {
            foreach ($p->lines as $l) {
                $sortie[$l->code] = [$l->exact, $l->rounded];
            }
        }
    }

    return $sortie;
}

it('arrondit au plus proche, 0,50 vers le haut, y compris sous zéro', function (int $centimes, int $attendu): void {
    expect(Rounding::toMajor($centimes, 100))->toBe($attendu);
})->with([[49, 0], [50, 100], [51, 100], [149, 100], [150, 200], [0, 0], [-49, 0], [-50, 0], [-51, -100], [-150, -100], [-151, -200]]);

it('calcule le jeu de référence fait à la main : lignes arrondies une à une, totaux recalculés, exacts conservés', function (): void {
    $faits = new IncomeFacts(
        [
            new F('p1', '211', 780049, F::RENT, 'lot-1'),
            new F('p1', '221', 62350, F::EXPENSE, 'dep-gestion'),
            new F('p1', '223', 18049, F::EXPENSE, 'dep-assurance'),
            new F('p1', '224', 12345, F::EXPENSE, 'dep-robinet'),
            new F('p1', '224', 50000, F::SUPPLIER_INVOICE, 'fac-chaudiere'),
            new F('p1', '227', 105000, F::EXPENSE, 'dep-taxe'),
            new F('p1', '229', 40050, F::EXPENSE, 'dep-provisions'),
            new F('p1', '230', 9950, F::CO_OWNERSHIP_STATEMENT, 'releve-n1'),
            new F('p1', '250', 190049, F::LOAN_ATTESTATION, 'pret-1'),
            new F('p2', '211', 50000, F::RENT, 'lot-2'),
        ],
        ['p1' => 'Appartement Port', 'p2' => 'Garage'],
        ['p1' => 1],
    );

    $r = calculer($faits);
    $p1 = lignesDuBien($r, 'p1');

    expect($p1['211'])->toBe([780049, 780000])
        ->and($p1['221'])->toBe([62350, 62400])
        ->and($p1['222'])->toBe([2000, 2000])
        ->and($p1['223'])->toBe([18049, 18000])
        ->and($p1['224'])->toBe([62345, 62300])
        ->and($p1['227'])->toBe([105000, 105000])
        ->and($p1['229'])->toBe([40050, 40100])
        ->and($p1['230'])->toBe([9950, 10000])
        ->and($p1['250'])->toBe([190049, 190000])
        ->and($p1['215'])->toBe([780049, 780000])
        ->and($p1['240'])->toBe([279844, 279800])
        ->and($p1['261'])->toBe([469893, 469800])
        ->and($p1['263'])->toBe([310156, 310200]);

    $total = collect($r->totals)->keyBy('code');

    expect($total['215']->rounded)->toBe(830000)
        ->and($total['263']->rounded)->toBe(310200 + 50000)
        ->and($r->micro)->toBe(['gross_receipts' => 830000, 'allowance_bp' => 3000, 'base_after_allowance' => 581000, 'threshold' => 1500000, 'real_base' => 360200])
        ->and($r->deficit)->toBeNull()
        ->and($r->formVersion)->toBe('fr-2044-2025')
        ->and($r->properties[0]->name)->toBe('Appartement Port')
        ->and($r->properties[1]->name)->toBe('Garage');
});

it('marque la ligne 230 comme proposée, les lignes saisies par le contribuable comme à compléter, et garde les sources', function (): void {
    $r = calculer(new IncomeFacts([new F('p1', '230', 9950, F::CO_OWNERSHIP_STATEMENT, 'releve-n1'), new F('p1', '212', 999999, F::RENT, 'intrus')], ['p1' => 'Bien'], []));
    $lignes = collect($r->properties[0]->lines)->keyBy('code');

    expect($lignes['230']->status)->toBe('proposed')->and($lignes['230']->sources)->toBe([['kind' => 'co_ownership_statement', 'ref' => 'releve-n1', 'amount' => 9950]])
        ->and($lignes['212']->status)->toBe('to_complete')->and($lignes['212']->exact)->toBe(0)->and($lignes['212']->sources)->toBe([])
        ->and($lignes['215']->exact)->toBe(0);
});

it('un conflit sur les intérêts laisse la ligne 250 à zéro, jamais un choix silencieux', function (): void {
    $faits = new IncomeFacts([new F('p1', '250', 55000, F::LOAN_ATTESTATION, 'pret-1')], ['p1' => 'Bien'], [], blockers: [['code' => 'interest_source_conflict', 'property_id' => 'p1']]);
    $r = calculer($faits);
    $l250 = collect($r->properties[0]->lines)->keyBy('code')['250'];

    expect($l250->status)->toBe('conflict')->and($l250->exact)->toBe(0)->and($l250->rounded)->toBe(0)->and($r->blockers)->toBe([['code' => 'interest_source_conflict', 'property_id' => 'p1']]);
});

it('simule le déficit seulement si le foyer est entièrement dans l\'application : intérêts reportés, autres charges plafonnées', function (): void {
    $faits = new IncomeFacts(
        [new F('p1', '211', 100000, F::RENT), new F('p1', '224', 2000000, F::EXPENSE), new F('p1', '250', 200000, F::LOAN_SCHEDULE)],
        ['p1' => 'Bien'],
        ['p1' => 1],
    );

    expect(calculer($faits)->deficit)->toBeNull()
        ->and(calculer($faits, true)->deficit)->toBe(['result' => -2102000, 'interest_part' => 200000, 'other_part' => 1902000, 'imputable_on_global_income' => 1070000, 'carried_forward' => 832000]);
});

it('un déficit entièrement dû aux intérêts ne s\'impute pas sur le revenu global', function (): void {
    $faits = new IncomeFacts([new F('p1', '211', 100000, F::RENT), new F('p1', '250', 300000, F::LOAN_SCHEDULE)], ['p1' => 'Bien'], []);

    expect(calculer($faits, true)->deficit)->toBe(['result' => -200000, 'interest_part' => 200000, 'other_part' => 0, 'imputable_on_global_income' => 0, 'carried_forward' => 0]);
});

it('un résultat positif ne produit aucun déficit', function (): void {
    expect(calculer(new IncomeFacts([new F('p1', '211', 100000, F::RENT)], ['p1' => 'Bien'], []), true)->deficit)
        ->toBe(['result' => 100000, 'interest_part' => 0, 'other_part' => 0, 'imputable_on_global_income' => 0, 'carried_forward' => 0]);
});

it('plafonne les sources gardées par ligne et le signale, sans rien perdre du montant', function (): void {
    $entrees = array_map(fn (int $i): F => new F('p1', '211', 100, F::RENT, "r{$i}"), range(1, 5));
    $r = calculer(new IncomeFacts($entrees, ['p1' => 'Bien'], []), max: 3);
    $l211 = collect($r->properties[0]->lines)->keyBy('code')['211'];

    expect($l211->exact)->toBe(500)->and($l211->sources)->toHaveCount(3)->and($l211->sourcesTruncated)->toBeTrue()
        ->and(collect($r->warnings)->pluck('code')->all())->toContain('sources_truncated');
});

it('avertit d\'une quote-part et d\'une ligne négative', function (): void {
    $faits = new IncomeFacts([new F('p1', '221', -5000, F::EXPENSE)], ['p1' => 'Bien'], [], ['p1' => [['share_bp' => 5000, 'nature' => 'full'], ['share_bp' => 5000, 'nature' => 'full']]]);
    $codes = collect(calculer($faits)->warnings)->pluck('code')->all();

    expect($codes)->toContain('shared_ownership')->toContain('negative_line');
});

it('ne compte aucun forfait 222 sans local loué, et 20 € par local sinon', function (): void {
    $r = calculer(new IncomeFacts([], ['p1' => 'A', 'p2' => 'B'], ['p2' => 3]));

    expect(lignesDuBien($r, 'p1')['222'])->toBe([0, 0])->and(lignesDuBien($r, 'p2')['222'])->toBe([6000, 6000]);
});

it('produit la même empreinte pour les mêmes faits et une autre si un montant change d\'un centime', function (): void {
    $faits = fn (int $m): IncomeFacts => new IncomeFacts([new F('p1', '211', $m, F::RENT)], ['p1' => 'Bien'], []);

    expect(calculer($faits(100000))->fingerprint())->toBe(calculer($faits(100000))->fingerprint())->not->toBe(calculer($faits(100001))->fingerprint());
});

it('refuse une année sans millésime : jamais de repli sur l\'année précédente', function (): void {
    $regles = new FrRentalIncomeRules;

    expect($regles->form(2026))->toBeNull()->and($regles->form(2024))->toBeNull()->and($regles->supportedYears())->toBe([2025]);
});
