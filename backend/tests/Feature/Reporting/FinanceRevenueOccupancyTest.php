<?php

declare(strict_types=1);

use App\Modules\Leases\Models\Lease;
use App\Modules\Organizations\Enums\OrganizationKind;
use App\Modules\Properties\Models\Unit;
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

it('recettes et charges par mois : loyer et provision appelés en mars, deux dépenses payées, financement à part', function (): void {
    T::depense($this, $this->b, 'insurance', 12000, ['document_on' => '2025-03-10', 'paid_on' => '2025-03-12'])->assertCreated();
    T::depense($this, $this->b, 'repairs', 4000, ['document_on' => '2025-04-01', 'paid_on' => '2025-04-01'])->assertCreated();
    I::pret($this, $this->b, ['principal' => 1200000, 'nominal_rate' => '12', 'term_months' => 3, 'first_due_on' => '2025-04-30'])->assertCreated();

    $r = $this->getJson(R::url($this->org, '/finance/revenue-expenses?from=2025-01-01&to=2025-04-30'))->assertOk();

    $r->assertJsonPath('data.basis', 'ledger')
        ->assertJsonPath('data.months.2.month', '2025-03')
        ->assertJsonPath('data.months.2.revenue.rent.amount', 65000)
        ->assertJsonPath('data.months.2.revenue.charges.amount', 5000)
        ->assertJsonPath('data.months.2.revenue.total.amount', 70000)
        ->assertJsonPath('data.months.2.expenses.ledger.amount', 12000)
        ->assertJsonPath('data.months.2.net_before_financing.amount', 58000)
        ->assertJsonPath('data.months.3.expenses.ledger.amount', 4000)
        ->assertJsonPath('data.months.3.expenses.declared.amount', 0)
        ->assertJsonPath('data.months.3.financing.interest.amount', 12000)
        ->assertJsonPath('data.months.3.net_before_financing.amount', -4000)
        ->assertJsonPath('data.months.3.net_after_financing.amount', -16000)
        ->assertJsonPath('data.months.0.revenue.total.amount', 0)
        ->assertJsonPath('data.totals.revenue.amount', 70000)
        ->assertJsonPath('data.totals.expenses.amount', 16000)
        ->assertJsonPath('data.totals.financing.amount', 12000)
        ->assertJsonPath('data.totals.net_before_financing.amount', 54000)
        ->assertJsonPath('data.totals.net_after_financing.amount', 42000)
        ->assertJsonCount(1, 'data.units')
        ->assertJsonPath('data.units.0.unit_id', $this->b['unit']->id)
        ->assertJsonPath('data.units.0.revenue.amount', 70000)
        ->assertJsonPath('data.units.0.expenses.amount', 16000);
});

it('bornes semi-ouvertes : le 30 avril compte, le 1er mai non ; les mois hors fenêtre sont absents', function (): void {
    I::pret($this, $this->b, ['principal' => 1200000, 'nominal_rate' => '12', 'term_months' => 3, 'first_due_on' => '2025-04-30'])->assertCreated();

    $avril = $this->getJson(R::url($this->org, '/finance/revenue-expenses?from=2025-04-01&to=2025-04-30'))->assertOk();
    $mars = $this->getJson(R::url($this->org, '/finance/revenue-expenses?from=2025-03-01&to=2025-03-31'))->assertOk();

    $avril->assertJsonCount(1, 'data.months')->assertJsonPath('data.months.0.financing.interest.amount', 12000)->assertJsonPath('data.totals.revenue.amount', 0);
    $mars->assertJsonCount(1, 'data.months')->assertJsonPath('data.totals.financing.amount', 0)->assertJsonPath('data.totals.revenue.amount', 70000);
});

it('une organisation sans mouvement répond des zéros, jamais une erreur', function (): void {
    $vide = C::organisation(OrganizationKind::Individual, 'Mme Vide');
    T::comme($this, L::titulaire($vide));

    $this->getJson(R::url($vide, '/finance/revenue-expenses?from=2025-01-01&to=2025-03-31'))->assertOk()
        ->assertJsonCount(3, 'data.months')->assertJsonPath('data.totals.revenue.amount', 0)->assertJsonPath('data.units', []);
});

it('occupation : un lot occupé toute la fenêtre est `occupied`, taux 100 %', function (): void {
    $r = $this->getJson(R::url($this->org, '/finance/occupancy?from=2025-01-01&to=2025-04-30'))->assertOk();

    $r->assertJsonCount(1, 'data.units')
        ->assertJsonPath('data.units.0.months.1.state', 'occupied')
        ->assertJsonPath('data.units.0.months.1.occupied_days', 28)
        ->assertJsonPath('data.summary.3.occupancy_rate_bp', 10000);
});

it('occupation : avant le début du bail le lot est vacant, jours occupés au prorata (bornes semi-ouvertes)', function (): void {
    $r = $this->getJson(R::url($this->org, '/finance/occupancy?from=2024-11-15&to=2025-01-31'))->assertOk();

    $r->assertJsonPath('data.units.0.months.0.state', 'vacant')
        ->assertJsonPath('data.units.0.months.0.occupied_days', 0)
        ->assertJsonPath('data.units.0.months.0.days', 16)
        ->assertJsonPath('data.units.0.months.2.state', 'occupied')
        ->assertJsonPath('data.summary.0.vacant', 1)
        ->assertJsonPath('data.summary.0.occupancy_rate_bp', 0)
        ->assertJsonPath('data.summary.2.occupancy_rate_bp', 10000);
});

it('occupation : un préavis reçu fait passer les mois concernés en `notice`, puis le lot redevient vacant après le départ', function (): void {
    $lot = $this->b['unit'];
    L::dans($this->org, function (): void {
        Lease::query()->update(['notice_received_on' => '2025-02-10', 'notice_given_by' => 'tenant', 'notice_departure_on' => '2025-04-15']);
    });

    $r = $this->getJson(R::url($this->org, '/finance/occupancy?from=2025-01-01&to=2025-05-31'))->assertOk();

    $r->assertJsonPath('data.units.0.unit_id', $lot->id)
        ->assertJsonPath('data.units.0.months.0.state', 'occupied')
        ->assertJsonPath('data.units.0.months.1.state', 'notice')
        ->assertJsonPath('data.units.0.months.3.state', 'notice')
        ->assertJsonPath('data.units.0.months.3.occupied_days', 14)
        ->assertJsonPath('data.units.0.months.4.state', 'vacant')
        ->assertJsonPath('data.summary.1.notice', 1)
        ->assertJsonPath('data.summary.4.vacant', 1)
        ->assertJsonPath('data.summary.3.occupancy_rate_bp', 4667);
});

it('occupation : les lots archivés sont exclus, ceux d\'une autre organisation jamais lus', function (): void {
    $autre = C::bail(C::organisation(OrganizationKind::Individual, 'Autre'));

    $this->getJson(R::url($this->org, '/finance/occupancy?from=2025-01-01&to=2025-01-31'))->assertOk()
        ->assertJsonCount(1, 'data.units')
        ->assertJsonMissing(['unit_id' => $autre['lot']->id]);

    L::dans($this->org, fn (): int => Unit::query()->whereKey($this->b['unit']->id)->update(['archived_at' => now()]));

    $this->getJson(R::url($this->org, '/finance/occupancy?from=2025-01-01&to=2025-01-31'))->assertOk()->assertJsonCount(0, 'data.units');
});
