<?php

declare(strict_types=1);

use App\Modules\Leases\Models\Lease;
use App\Modules\Leases\Models\LeaseTerm;
use App\Modules\Organizations\Enums\OrganizationKind;
use App\Modules\Reporting\Models\ForecastAssumption;
use App\Shared\Audit\AuditLog;
use Illuminate\Testing\TestResponse;
use Tests\Feature\Investments\InvestmentsContext as I;
use Tests\Feature\Leases\LeasesContext as L;
use Tests\Feature\Rent\RentContext;
use Tests\Feature\Reporting\ReportingContext as R;
use Tests\Feature\Tax\TaxContext as T;

beforeEach(function (): void {
    T::preparer($this);
    $this->b = T::bailleur2025($this);
    $this->org = $this->b['org'];
    T::comme($this, $this->b['owner']);
});

function previsionnel(object $test): TestResponse
{
    return $test->getJson(R::url($test->org, '/finance/forecast'))->assertOk();
}

function hypotheses(array $surcharges = []): array
{
    return ['lock_version' => 0, 'indexation_rate' => '0', 'expense_growth_rate' => '0', 'vacancies' => [], 'one_off_expenses' => [], ...$surcharges];
}

it('12 mois à partir du mois courant : loyer et provision du bail en cours, ouverture à la banque du mois précédent, rien de stocké', function (): void {
    $r = previsionnel($this);

    $r->assertJsonPath('data.kind', 'projection')
        ->assertJsonPath('data.notice', 'Projection, ce n\'est pas un solde')
        ->assertJsonPath('data.from', '2025-04-01')
        ->assertJsonPath('data.to', '2026-03-31')
        ->assertJsonCount(12, 'data.months')
        ->assertJsonPath('data.opening.as_of', '2025-03-31')
        ->assertJsonPath('data.opening.amount.amount', 30000)
        ->assertJsonPath('data.months.0.month', '2025-04')
        ->assertJsonPath('data.months.0.inflows.rent.amount', 65000)
        ->assertJsonPath('data.months.0.inflows.charges.amount', 5000)
        ->assertJsonPath('data.months.0.closing.amount', 100000)
        ->assertJsonPath('data.months.11.month', '2026-03')
        ->assertJsonPath('data.months.11.closing.amount', 30000 + 12 * 70000)
        ->assertJsonPath('data.assumptions.lock_version', 0)
        ->assertJsonPath('data.assumptions.official_index', false)
        ->assertJsonPath('data.expense_categories', []);
    expect(L::dans($this->org, fn (): int => ForecastAssumption::query()->count()))->toBe(0);
});

it('la fin du bail est respectée au prorata des jours, sans renouvellement supposé', function (): void {
    L::dans($this->org, fn (): int => Lease::query()->update(['ends_on' => '2025-07-16']));

    $r = previsionnel($this);

    // Juillet : 15 jours sur 31. Loyer 65000 x 15 / 31 = 31451,6 -> 31452 ; provision 5000 x 15 / 31 = 2419,35 -> 2419.
    $r->assertJsonPath('data.months.2.inflows.rent.amount', 65000)
        ->assertJsonPath('data.months.3.month', '2025-07')
        ->assertJsonPath('data.months.3.inflows.rent.amount', 31452)
        ->assertJsonPath('data.months.3.inflows.charges.amount', 2419)
        ->assertJsonPath('data.months.4.inflows.total.amount', 0)
        ->assertJsonPath('data.months.11.inflows.total.amount', 0);
});

it('indexation hypothétique au mois anniversaire des seules lignes indexées, vacance saisie retirée au jour près', function (): void {
    L::dans($this->org, fn (): int => LeaseTerm::query()->where('amount', '>', 60000)->update(['indexed' => true]));
    $this->putJson(R::url($this->org, '/finance/forecast/assumptions'), hypotheses([
        'indexation_rate' => '3.2',
        'vacancies' => [['unit_id' => $this->b['unit']->id, 'from' => '2025-06-10', 'to' => '2025-06-19']],
    ]))->assertOk()->assertJsonPath('data.indexation_rate', '3.200')->assertJsonPath('data.lock_version', 1);

    $r = previsionnel($this);

    // Juin : 20 jours payés sur 30 -> loyer 43333 (43333,3), provision 3333 (3333,3). Janvier 2026 (anniversaire) : 65000 x 1,032 = 67080 ; provision non indexée.
    $r->assertJsonPath('data.months.1.inflows.rent.amount', 65000)
        ->assertJsonPath('data.months.2.month', '2025-06')
        ->assertJsonPath('data.months.2.inflows.rent.amount', 43333)
        ->assertJsonPath('data.months.2.inflows.charges.amount', 3333)
        ->assertJsonPath('data.months.8.month', '2025-12')
        ->assertJsonPath('data.months.8.inflows.rent.amount', 65000)
        ->assertJsonPath('data.months.9.month', '2026-01')
        ->assertJsonPath('data.months.9.inflows.rent.amount', 67080)
        ->assertJsonPath('data.months.9.inflows.charges.amount', 5000)
        ->assertJsonPath('data.months.11.inflows.rent.amount', 67080)
        ->assertJsonPath('data.assumptions.vacancies.0.to', '2025-06-19');
});

it('sorties : moyenne mensuelle des 12 derniers mois par catégorie majorée, échéances de prêt, dépense ponctuelle', function (): void {
    T::depense($this, $this->b, 'insurance', 12000)->assertCreated();
    I::pret($this, $this->b, ['principal' => 1200000, 'nominal_rate' => '12', 'term_months' => 3, 'first_due_on' => '2025-05-31'])->assertCreated();
    $this->putJson(R::url($this->org, '/finance/forecast/assumptions'), hypotheses([
        'expense_growth_rate' => '5',
        'one_off_expenses' => [['month' => '2025-08', 'label' => 'Toiture', 'amount' => 20000]],
    ]))->assertOk();

    $r = previsionnel($this);

    // Assurance 12000 sur 12 mois = 1000 par mois, +5 % = 1050. Prêt : mensualités 408027 en mai et juin (1 200 000 x 0,01 / (1 - 1,01^-3) = 408 026,53, arrondi à 408 027), intérêts exclus des dépenses.
    $r->assertJsonPath('data.opening.amount.amount', 18000)
        ->assertJsonPath('data.expense_categories.0.category', 'expense.insurance')
        ->assertJsonPath('data.expense_categories.0.monthly.amount', 1050)
        ->assertJsonPath('data.months.0.outflows.expenses.amount', 1050)
        ->assertJsonPath('data.months.0.outflows.loans.amount', 0)
        ->assertJsonPath('data.months.1.outflows.loans.amount', 408027)
        ->assertJsonPath('data.months.2.outflows.loans.amount', 408027)
        ->assertJsonPath('data.months.4.outflows.one_off.amount', 20000)
        ->assertJsonPath('data.months.4.outflows.total.amount', 1050 + 20000)
        ->assertJsonPath('data.months.0.net.amount', 70000 - 1050)
        ->assertJsonPath('data.months.0.closing.amount', 18000 + 70000 - 1050);
});

it('les intérêts de prêt saisis en dépense ne gonflent pas la moyenne (l\'échéancier les porte)', function (): void {
    T::depense($this, $this->b, 'loan_interest', 24000)->assertCreated();

    previsionnel($this)->assertJsonPath('data.expense_categories', [])->assertJsonPath('data.months.0.outflows.expenses.amount', 0);
});

it('hypothèses : enregistrées une fois par organisation, verrou optimiste, 409 forecast_assumptions_stale', function (): void {
    $url = R::url($this->org, '/finance/forecast/assumptions');

    $this->putJson($url, hypotheses(['indexation_rate' => '1.25']))->assertOk()->assertJsonPath('data.lock_version', 1)->assertJsonPath('data.indexation_rate', '1.250');
    $this->putJson($url, hypotheses(['indexation_rate' => '2']))->assertStatus(409)->assertJsonPath('code', 'forecast_assumptions_stale');
    $this->putJson($url, hypotheses(['lock_version' => 1, 'indexation_rate' => '2']))->assertOk()->assertJsonPath('data.lock_version', 2);

    expect(L::dans($this->org, fn (): int => ForecastAssumption::query()->count()))->toBe(1);
    previsionnel($this)->assertJsonPath('data.assumptions.indexation_rate', '2.000')->assertJsonPath('data.assumptions.lock_version', 2);
});

it('hypothèses : taux, bornes et formes refusés en liste blanche (422)', function (): void {
    $url = R::url($this->org, '/finance/forecast/assumptions');
    $lot = $this->b['unit']->id;
    $mauvaises = [
        ['indexation_rate' => '10.001'],
        ['indexation_rate' => '-1'],
        ['indexation_rate' => '1,5'],
        ['indexation_rate' => '1.2345'],
        ['expense_growth_rate' => '100'],
        ['vacancies' => [['unit_id' => $lot, 'from' => '2025-06-10', 'to' => '2025-06-01']]],
        ['vacancies' => [['unit_id' => $lot, 'from' => '2025-06-10', 'to' => '2025-06-19', 'organization_id' => $lot]]],
        ['vacancies' => array_fill(0, 25, ['unit_id' => $lot, 'from' => '2025-06-10', 'to' => '2025-06-19'])],
        ['one_off_expenses' => [['month' => '2025-08', 'label' => str_repeat('x', 81), 'amount' => 100]]],
        ['one_off_expenses' => [['month' => '2025-08', 'label' => 'Toit', 'amount' => 0]]],
        ['one_off_expenses' => [['month' => '2025-08-01', 'label' => 'Toit', 'amount' => 100]]],
        ['one_off_expenses' => [['month' => '2025-08', 'label' => 'Toit', 'amount' => 100, 'currency' => 'USD']]],
        ['lock_version' => -1],
    ];

    foreach ($mauvaises as $corps) {
        $this->putJson($url, hypotheses($corps))->assertStatus(422);
    }

    $this->putJson($url, ['lock_version' => 0])->assertStatus(422);
    expect(L::dans($this->org, fn (): int => ForecastAssumption::query()->count()))->toBe(0);
});

it('hypothèses : taux à 10 % exactement accepté, le client ne choisit ni l\'organisation ni la devise', function (): void {
    $autre = L::titulaire(RentContext::organisation(OrganizationKind::Individual, 'Autre'));

    $this->putJson(R::url($this->org, '/finance/forecast/assumptions'), hypotheses(['indexation_rate' => '10', 'expense_growth_rate' => '10.000', 'organization_id' => $autre->id, 'currency' => 'USD']))
        ->assertOk()->assertJsonPath('data.expense_growth_rate', '10.000');

    expect(ForecastAssumption::query()->withoutGlobalScopes()->where('organization_id', $this->org->id)->count())->toBe(1)
        ->and(ForecastAssumption::query()->withoutGlobalScopes()->count())->toBe(1);
});

it('hypothèses : un lot d\'une autre organisation est refusé (404 unit_not_found), rien n\'est écrit', function (): void {
    $orgAutre = RentContext::organisation(OrganizationKind::Individual, 'Autre');
    ['lot' => $lotAutre] = RentContext::bail($orgAutre);

    $this->putJson(R::url($this->org, '/finance/forecast/assumptions'), hypotheses(['vacancies' => [['unit_id' => $lotAutre->id, 'from' => '2025-06-10', 'to' => '2025-06-19']]]))
        ->assertNotFound()->assertJsonPath('code', 'unit_not_found');

    expect(ForecastAssumption::query()->withoutGlobalScopes()->count())->toBe(0);
});

it('le journal garde l\'action sans libellé ni montant, et les hypothèses d\'une organisation ne se lisent pas depuis une autre', function (): void {
    $this->putJson(R::url($this->org, '/finance/forecast/assumptions'), hypotheses(['one_off_expenses' => [['month' => '2025-08', 'label' => 'Toiture secrète', 'amount' => 123456]]]))->assertOk();

    $journal = AuditLog::query()->where('organization_id', $this->org->id)->get()->filter(fn ($l): bool => str_contains((string) $l->action, 'forecast') || $l->subject_type === 'forecast_assumption');

    expect($journal->pluck('action')->all())->toContain('reporting.forecast.assumptions_updated')
        ->and(json_encode($journal->map->toArray()->all()))->not->toContain('Toiture')->not->toContain('123456');

    $orgAutre = RentContext::organisation(OrganizationKind::Individual, 'Autre');
    T::comme($this, L::titulaire($orgAutre));
    $this->getJson(R::url($orgAutre, '/finance/forecast'))->assertOk()->assertJsonPath('data.assumptions.lock_version', 0)->assertJsonPath('data.assumptions.one_off_expenses', []);
});
