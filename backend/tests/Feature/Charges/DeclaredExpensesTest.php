<?php

declare(strict_types=1);

use App\Modules\Charges\PublicApi\DeclaredExpenses;
use Carbon\CarbonImmutable;
use Illuminate\Support\Str;
use Tests\Feature\Charges\ChargesContext as C;
use Tests\Feature\Leases\LeasesContext as L;

beforeEach(function (): void {
    C::preparer($this);
});

function declarees(array $scene, string $de = '2026-01-01', string $a = '2027-01-01', ?array $lots = null): array
{
    return L::dans($scene['org'], fn (): array => app(DeclaredExpenses::class)->between(CarbonImmutable::parse($de), CarbonImmutable::parse($a), $lots));
}

it('ne lit que les dépenses payées par le mandant ou sans règlement, jamais celles du grand livre', function (): void {
    $scene = C::agence();
    C::comme($this, $scene['owner']);

    $mandant = C::depense($this, $scene, ['settlement' => 'paid_by_owner', 'recoverable_amount' => 0, 'recoverable_rubric' => null, 'category_term_id' => C::categorie('property_tax'), 'total_gross' => 30000, 'tax_amount' => 0])->assertCreated()->json('data.id');
    $syndic = C::depense($this, $scene, ['kind' => 'co_ownership_statement', 'settlement' => 'none', 'category_term_id' => C::categorie('co_ownership'), 'recoverable_rubric' => 'building_equipment', 'paid_on' => null, 'document_on' => '2026-06-30'])->assertCreated()->json('data.id');
    C::depense($this, $scene)->assertCreated();

    $lues = declarees($scene);

    expect($lues)->toHaveCount(2)->and(array_column($lues, 'id'))->toBe([$mandant, $syndic])
        ->and($lues[0]->settlement)->toBe('paid_by_owner')->and($lues[0]->amount->getAmount())->toBe('30000')->and($lues[0]->date)->toBe('2026-03-12')
        ->and($lues[1]->settlement)->toBe('none')->and($lues[1]->date)->toBe('2026-06-30')->and($lues[0]->mandantPartyId)->toBe($scene['mandant']->id);
});

it('borne la période en intervalle semi-ouvert, filtre par lot et écarte une dépense annulée', function (): void {
    $scene = C::agence();
    C::comme($this, $scene['owner']);
    $corps = ['settlement' => 'paid_by_owner', 'recoverable_amount' => 0, 'recoverable_rubric' => null, 'category_term_id' => C::categorie('property_tax')];

    C::depense($this, $scene, [...$corps, 'paid_on' => '2026-03-12'])->assertCreated();
    $annulee = C::depense($this, $scene, [...$corps, 'paid_on' => '2026-04-01', 'reference' => 'F-AUTRE'])->assertCreated()->json('data.id');
    $this->postJson(C::url($scene['org'], "/expenses/{$annulee}/cancel"), ['reason' => 'Saisie en double'])->assertOk();

    expect(declarees($scene))->toHaveCount(1)
        ->and(declarees($scene, '2026-03-12', '2026-03-13'))->toHaveCount(1)
        ->and(declarees($scene, '2026-03-13', '2026-04-01'))->toHaveCount(0)
        ->and(declarees($scene, '2026-01-01', '2026-03-12'))->toHaveCount(0)
        ->and(declarees($scene, lots: [$scene['unit']->id]))->toHaveCount(1)
        ->and(declarees($scene, lots: []))->toHaveCount(0)
        ->and(declarees($scene, lots: [(string) Str::uuid7()]))->toHaveCount(0);
});

it('ne lit rien d\'une autre organisation', function (): void {
    $a = C::agence();
    C::comme($this, $a['owner']);
    C::depense($this, $a, ['settlement' => 'paid_by_owner', 'recoverable_amount' => 0, 'recoverable_rubric' => null, 'category_term_id' => C::categorie('property_tax')])->assertCreated();

    $b = C::autonome();

    expect(declarees($a))->toHaveCount(1)->and(declarees($b))->toHaveCount(0);
});
