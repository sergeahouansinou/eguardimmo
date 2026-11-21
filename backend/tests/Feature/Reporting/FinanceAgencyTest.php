<?php

declare(strict_types=1);

use Carbon\CarbonImmutable;
use Tests\Feature\Charges\ChargesContext as Ch;
use Tests\Feature\Reporting\ReportingContext as R;

it('agence : les honoraires sont la recette, le loyer du mandant n\'en est pas une', function (): void {
    ['org' => $this->org, 'bail' => $this->bail, 'mandant' => $this->mandant] = R::agence($this);
    R::parcours($this);

    $r = $this->getJson(R::url($this->org, '/finance/revenue-expenses?from=2026-01-01&to=2026-12-31'))->assertOk();

    $r->assertJsonPath('data.months.10.revenue.rent.amount', 0)
        ->assertJsonPath('data.totals.revenue.amount', 4900)
        ->assertJsonPath('data.months.11.revenue.fees.amount', 4900)
        ->assertJsonPath('data.totals.expenses.amount', 0);
});

it('agence : une dépense payée par le mandant est déclarée, hors grand livre, et n\'est pas une recette', function (): void {
    Ch::preparer($this);
    $scene = Ch::agence();
    $this->travelTo(CarbonImmutable::parse('2026-04-01 10:00:00'));
    Ch::comme($this, $scene['owner']);
    Ch::depense($this, $scene, ['settlement' => 'paid_by_owner', 'recoverable_amount' => 0, 'recoverable_rubric' => null, 'category_term_id' => Ch::categorie('property_tax'), 'total_gross' => 30000, 'tax_amount' => 0])->assertCreated();

    $r = $this->getJson(R::url($scene['org'], '/finance/revenue-expenses?from=2026-01-01&to=2026-06-30'))->assertOk();

    $r->assertJsonPath('data.months.2.expenses.declared.amount', 30000)
        ->assertJsonPath('data.months.2.expenses.ledger.amount', 0)
        ->assertJsonPath('data.totals.expenses.amount', 30000)
        ->assertJsonPath('data.units.0.unit_id', $scene['unit']->id)
        ->assertJsonPath('data.units.0.expenses.amount', 30000);
});
