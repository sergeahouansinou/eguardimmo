<?php

declare(strict_types=1);

use App\Modules\Tax\Actions\ComputeRentalIncome;
use App\Modules\Tax\Data\RentalIncomeData;
use App\Shared\Http\ApiProblem;
use Tests\Feature\Investments\InvestmentsContext as I;
use Tests\Feature\Leases\LeasesContext as L;
use Tests\Feature\Rent\RentContext;
use Tests\Feature\Tax\TaxContext as T;

beforeEach(function (): void {
    T::preparer($this);
});

function revenus(array $scene, int $annee = 2025, bool $foyer = false): RentalIncomeData
{
    return L::dans($scene['org'], fn (): RentalIncomeData => app(ComputeRentalIncome::class)->handle($annee, $foyer)->income);
}

/**
 * @return array<string, array{int, int, string}>
 */
function lignesRevenus(RentalIncomeData $r, ?string $bien = null): array
{
    $sortie = [];

    foreach ($r->properties as $p) {
        if ($bien === null || $p->propertyId === $bien) {
            foreach ($p->lines as $l) {
                $sortie[$l->code] = [$l->exact, $l->rounded, $l->status];
            }
        }
    }

    return $sortie;
}

it('lit les loyers encaissés au prorata de l\'appel, le forfait 222 et la taxe foncière sans TEOM', function (): void {
    $scene = T::bailleur2025($this);
    T::comme($this, $scene['owner']);
    T::depense($this, $scene, 'property_tax', 90000, ['recoverable_amount' => 15000, 'recoverable_rubric' => 'taxes_and_fees'])->assertCreated();

    $l = lignesRevenus(revenus($scene));

    expect($l['211'])->toBe([27857, 27900, 'computed'])
        ->and($l['222'])->toBe([2000, 2000, 'computed'])
        ->and($l['227'])->toBe([75000, 75000, 'computed'])
        ->and($l['215'][1])->toBe(27900)
        ->and($l['240'][1])->toBe(77000)
        ->and($l['263'][1])->toBe(27900 - 77000);
});

it('jeu de référence fait à la main : gestion, assurance, travaux, copropriété, régularisation du relevé de l\'an passé, non classé', function (): void {
    $scene = T::bailleur2025($this);
    T::comme($this, $scene['owner']);
    T::depense($this, $scene, 'property_tax', 90000, ['recoverable_amount' => 15000, 'recoverable_rubric' => 'taxes_and_fees'])->assertCreated();
    T::depense($this, $scene, 'management_fees', 62350)->assertCreated();
    T::depense($this, $scene, 'insurance', 18049)->assertCreated();
    T::depense($this, $scene, 'repairs', 12345)->assertCreated();
    T::depense($this, $scene, 'co_ownership', 40050)->assertCreated();
    $autre = T::depense($this, $scene, 'other', 5000)->assertCreated()->json('data.id');
    T::depense($this, $scene, 'co_ownership', 80000, ['document_on' => '2024-06-10', 'service_from' => '2024-01-01', 'service_to' => '2025-01-01', 'paid_on' => '2024-06-12'])->assertCreated();
    T::depense($this, $scene, 'co_ownership', 100000, ['kind' => 'co_ownership_statement', 'settlement' => 'none', 'paid_on' => null, 'recoverable_amount' => 30000, 'recoverable_rubric' => 'building_equipment', 'document_on' => '2025-02-20', 'service_from' => '2024-01-01', 'service_to' => '2025-01-01'])->assertCreated();

    $r = revenus($scene);
    $l = lignesRevenus($r);

    expect($l['211'])->toBe([27857, 27900, 'computed'])
        ->and($l['221'])->toBe([62350, 62400, 'computed'])
        ->and($l['222'])->toBe([2000, 2000, 'computed'])
        ->and($l['223'])->toBe([18049, 18000, 'computed'])
        ->and($l['224'])->toBe([12345, 12300, 'computed'])
        ->and($l['227'])->toBe([75000, 75000, 'computed'])
        ->and($l['229'])->toBe([40050, 40100, 'computed'])
        ->and($l['230'])->toBe([10000, 10000, 'proposed'])
        ->and($l['240'])->toBe([199794, 199800, 'total'])
        ->and($l['261'])->toBe([199794, 199800, 'total'])
        ->and($l['263'])->toBe([27857 - 199794, 27900 - 199800, 'total'])
        ->and($l['250'])->toBe([0, 0, 'computed'])
        ->and(collect($r->warnings)->where('code', 'unclassified_expense')->pluck('detail')->all())->toBe([$autre]);
});

it('ligne 250 : l\'attestation de la banque fait foi ; une dépense d\'intérêts sur un bien suivi bloque, sans prêt elle compte', function (): void {
    $scene = T::bailleur2025($this);
    T::comme($this, $scene['owner']);
    $pret = I::pret($this, $scene)->assertCreated()->json('data.id');
    $this->post(I::url($scene['org'], "/loans/{$pret}/attestations"), ['income_year' => 2025, 'interest' => 70000, 'insurance' => 3000, 'document' => I::pdf('attestation.pdf')], ['Accept' => 'application/json'])->assertCreated();

    $l = lignesRevenus(revenus($scene));
    expect($l['250'])->toBe([73000, 73000, 'computed']);

    T::depense($this, $scene, 'loan_interest', 55000)->assertCreated();
    $r = revenus($scene);

    expect(lignesRevenus($r)['250'])->toBe([0, 0, 'conflict'])
        ->and($r->blockers)->toBe([['code' => 'interest_source_conflict', 'property_id' => $scene['property']]]);
});

it('sans prêt suivi, une dépense « intérêts d\'emprunt » alimente la ligne 250', function (): void {
    $scene = T::bailleur2025($this);
    T::comme($this, $scene['owner']);
    T::depense($this, $scene, 'loan_interest', 55049)->assertCreated();

    $r = revenus($scene);

    expect(lignesRevenus($r)['250'])->toBe([55049, 55000, 'computed'])->and($r->blockers)->toBe([]);
});

it('écarte un bail meublé : son loyer n\'entre pas en 211 et ses locaux ne comptent pas pour le forfait 222', function (): void {
    $scene = T::bailleur2025($this);
    ['bail' => $meuble] = RentContext::bail($scene['org'], ['regime_key' => 'fr.residential.furnished', 'starts_on' => '2025-01-01', 'ends_on' => '2028-01-01', 'signed_on' => '2024-12-15']);
    $this->travelTo('2025-03-12 10:00:00');
    RentContext::emises($scene['org'], $meuble, $this, '2025-03-12 10:00:00');
    RentContext::payer($this, $scene['org'], $meuble, 70000, ['received_on' => '2025-03-12'])->assertCreated();

    $r = revenus($scene);

    expect(lignesRevenus($r)['211'][0])->toBe(27857)
        ->and(lignesRevenus($r)['222'][0])->toBe(2000)
        ->and(collect($r->warnings)->where('code', 'excluded_regime')->sum('amount'))->toBe(65000);
});

it('refuse l\'année sans millésime et une devise hors formulaire, jamais de repli', function (): void {
    $scene = T::bailleur2025($this);

    expect(fn () => revenus($scene, 2026))->toThrow(ApiProblem::class)
        ->and(fn () => revenus($scene, 2024))->toThrow(ApiProblem::class);
});
