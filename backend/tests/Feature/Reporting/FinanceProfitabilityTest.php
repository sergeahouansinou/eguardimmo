<?php

declare(strict_types=1);

use App\Modules\Organizations\Enums\OrganizationKind;
use Carbon\CarbonImmutable;
use Tests\Feature\Investments\InvestmentsContext as I;
use Tests\Feature\Leases\LeasesContext as L;
use Tests\Feature\Rent\RentContext as C;
use Tests\Feature\Reporting\ReportingContext as R;
use Tests\Feature\Tax\TaxContext as T;

beforeEach(function (): void {
    T::preparer($this);
    $this->b = T::bailleur2025($this);
    $this->org = $this->b['org'];
    T::comme($this, $this->b['owner']);
});

function acquerir(object $test, array $scene, array $corps = [], string $cle = 'acq-rentabilite-1'): void
{
    $test->postJson(I::url($scene['org'], '/acquisitions'), [
        'property_id' => $scene['property'],
        'acquired_on' => '2024-06-01',
        'price' => 900000,
        'acquisition_costs' => 70000,
        'agency_fees' => 30000,
        'initial_works' => 100000,
        ...$corps,
    ], ['Idempotency-Key' => $cle])->assertCreated();
}

function ligneRentabilite(object $test, int $annee = 2025, string $niveau = 'property'): array
{
    $reponse = $test->getJson(R::url($test->org, "/finance/profitability?year={$annee}"))->assertOk();

    return collect($reponse->json('data.rows'))->firstWhere('level', $niveau) ?? [];
}

it('brut, net et net après financement en points de base, demi supérieur, références calculées à part', function (): void {
    acquerir($this, $this->b);
    T::depense($this, $this->b, 'insurance', 12000)->assertCreated();
    $pret = I::pret($this, $this->b, ['principal' => 1200000, 'nominal_rate' => '12', 'term_months' => 3, 'first_due_on' => '2025-12-31'])->assertCreated()->json('data.id');
    $this->postJson(I::url($this->org, "/loans/{$pret}/fees"), ['kind' => 'dossier', 'paid_on' => '2025-03-01', 'amount' => 15000])->assertCreated();

    $r = $this->getJson(R::url($this->org, '/finance/profitability?year=2025'))->assertOk();

    // Coût de revient 900000 + 70000 + 30000 + 100000 = 1100000 ; loyers encaissés 27857 ; dépense 12000 ; financement 12000 + 15000.
    // Brut 27857 / 1100000 = 2,5324 % -> 253 ; net 15857 / 1100000 = 1,4415 % -> 144 ; après financement -11143 / 1100000 = -1,0130 % -> -101.
    $r->assertJsonPath('data.year', 2025)
        ->assertJsonPath('data.partial', true)
        ->assertJsonPath('data.assumptions.before_tax', true)
        ->assertJsonPath('data.assumptions.annualized', false)
        ->assertJsonPath('data.rows.0.level', 'property')
        ->assertJsonPath('data.rows.0.property_id', $this->b['property'])
        ->assertJsonPath('data.rows.0.cost.amount', 1100000)
        ->assertJsonPath('data.rows.0.rent_collected.amount', 27857)
        ->assertJsonPath('data.rows.0.expenses_unrecovered.amount', 12000)
        ->assertJsonPath('data.rows.0.financing.interest.amount', 12000)
        ->assertJsonPath('data.rows.0.financing.fees.amount', 15000)
        ->assertJsonPath('data.rows.0.financing.total.amount', 27000)
        ->assertJsonPath('data.rows.0.gross_bp', 253)
        ->assertJsonPath('data.rows.0.net_bp', 144)
        ->assertJsonPath('data.rows.0.net_after_financing_bp', -101)
        ->assertJsonPath('data.rows.0.reason', null)
        ->assertJsonPath('data.rows.0.partial_ownership', false)
        ->assertJsonPath('data.warnings', []);
});

it('une part récupérable est déduite de la dépense ; un net négatif s\'arrondit au demi supérieur (vers zéro à égalité)', function (): void {
    acquerir($this, $this->b);
    T::depense($this, $this->b, 'insurance', 12000)->assertCreated();
    T::depense($this, $this->b, 'property_tax', 90000, ['recoverable_amount' => 15000, 'recoverable_rubric' => 'taxes_and_fees'])->assertCreated();

    $ligne = ligneRentabilite($this);

    // Dépenses non récupérées 12000 + (90000 - 15000) = 87000 ; net 27857 - 87000 = -59143 -> -537,66 bp -> -538.
    expect($ligne['expenses_unrecovered']['amount'])->toBe(87000)->and($ligne['net_bp'])->toBe(-538)->and($ligne['gross_bp'])->toBe(253);
});

it('les intérêts saisis en dépense comptent comme financement tant que le bien n\'a pas de prêt suivi, jamais comme dépense', function (): void {
    acquerir($this, $this->b);
    T::depense($this, $this->b, 'loan_interest', 5000)->assertCreated();

    $sans = ligneRentabilite($this);

    expect($sans['expenses_unrecovered']['amount'])->toBe(0)->and($sans['financing']['interest']['amount'])->toBe(5000);

    I::pret($this, $this->b, ['principal' => 1200000, 'nominal_rate' => '12', 'term_months' => 3, 'first_due_on' => '2025-12-31'])->assertCreated();
    $avec = ligneRentabilite($this);

    expect($avec['expenses_unrecovered']['amount'])->toBe(0)->and($avec['financing']['interest']['amount'])->toBe(12000);
});

it('sans coût de revient : null et le motif cost_missing, jamais 0, les faits restent visibles', function (): void {
    T::depense($this, $this->b, 'insurance', 12000)->assertCreated();

    $ligne = ligneRentabilite($this);

    expect($ligne['cost'])->toBeNull()->and($ligne['gross_bp'])->toBeNull()->and($ligne['net_bp'])->toBeNull()->and($ligne['net_after_financing_bp'])->toBeNull()
        ->and($ligne['reason'])->toBe('cost_missing')->and($ligne['rent_collected']['amount'])->toBe(27857)->and($ligne['expenses_unrecovered']['amount'])->toBe(12000);
});

it('un bien acquis après l\'année : not_yet_acquired ; acquis en cours d\'année : partial_ownership, jamais annualisé', function (): void {
    acquerir($this, $this->b, ['acquired_on' => '2026-02-01']);

    expect(ligneRentabilite($this)['reason'])->toBe('not_yet_acquired')->and(ligneRentabilite($this)['gross_bp'])->toBeNull();

    $this->patchJson(I::url($this->org, '/acquisitions/'.$this->getJson(I::url($this->org, '/acquisitions'))->json('data.0.id')), ['acquired_on' => '2025-03-01', 'price' => 900000, 'acquisition_costs' => 70000, 'agency_fees' => 30000, 'initial_works' => 100000, 'lock_version' => 1])->assertOk();
    $ligne = ligneRentabilite($this);

    expect($ligne['partial_ownership'])->toBeTrue()->and($ligne['gross_bp'])->toBe(253)->and($ligne['reason'])->toBeNull();
});

it('coût de revient par lot : une ligne par lot, les faits sans lot sont signalés et jamais répartis', function (): void {
    acquerir($this, $this->b, ['unit_id' => $this->b['unit']->id]);
    ['lot' => $autreLot] = C::bail($this->org, ['starts_on' => '2025-01-01', 'ends_on' => '2028-01-01', 'signed_on' => '2024-12-15']);
    T::depense($this, $this->b, 'insurance', 12000, ['unit_id' => null])->assertCreated();

    $r = $this->getJson(R::url($this->org, '/finance/profitability?year=2025'))->assertOk();
    $ligne = collect($r->json('data.rows'))->firstWhere('level', 'unit');

    expect($ligne['unit_id'])->toBe($this->b['unit']->id)->and($ligne['cost']['amount'])->toBe(1100000)->and($ligne['gross_bp'])->toBe(253)->and($ligne['expenses_unrecovered']['amount'])->toBe(0)
        ->and($r->json('data.warnings.0.code'))->toBe('unallocated_amounts')->and($r->json('data.warnings.0.amount.amount'))->toBe(12000)
        ->and(collect($r->json('data.rows'))->pluck('unit_id')->filter()->all())->not->toContain($autreLot->id);
});

it('bornes semi-ouvertes : une dépense du 31 décembre est de l\'année, celle du 1er janvier de la suivante', function (): void {
    acquerir($this, $this->b);
    $this->travelTo(CarbonImmutable::parse('2026-01-15 10:00:00'));
    T::depense($this, $this->b, 'insurance', 12000, ['document_on' => '2025-12-31', 'paid_on' => '2025-12-31'])->assertCreated();
    T::depense($this, $this->b, 'repairs', 7000, ['document_on' => '2026-01-01', 'paid_on' => '2026-01-01'])->assertCreated();

    expect(ligneRentabilite($this, 2025)['expenses_unrecovered']['amount'])->toBe(12000)->and(ligneRentabilite($this, 2026)['expenses_unrecovered']['amount'])->toBe(7000);
});

it('cloisonnement : le coût de revient, les prêts et les dépenses d\'une autre organisation n\'apparaissent jamais', function (): void {
    $orgAutre = C::organisation(OrganizationKind::Individual, 'M. Dubois');
    ['lot' => $lotAutre] = C::bail($orgAutre, ['starts_on' => '2025-01-01', 'ends_on' => '2028-01-01', 'signed_on' => '2024-12-15']);
    $autre = ['org' => $orgAutre, 'owner' => L::titulaire($orgAutre), 'unit' => $lotAutre, 'property' => $lotAutre->property_id];
    T::comme($this, $autre['owner']);
    acquerir($this, $autre, [], 'acq-autre-org-1');
    T::depense($this, $autre, 'insurance', 99000)->assertCreated();
    T::comme($this, $this->b['owner']);

    $ligne = ligneRentabilite($this);

    expect($ligne['cost'])->toBeNull()->and($ligne['expenses_unrecovered']['amount'])->toBe(0)
        ->and(collect($this->getJson(R::url($this->org, '/finance/profitability?year=2025'))->json('data.rows'))->pluck('property_id')->all())->toBe([$this->b['property']]);
});
