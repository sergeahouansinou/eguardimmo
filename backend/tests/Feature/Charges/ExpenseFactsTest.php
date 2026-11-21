<?php

declare(strict_types=1);

use App\Modules\Charges\PublicApi\ExpenseFacts;
use Carbon\CarbonImmutable;
use Illuminate\Support\Str;
use Tests\Feature\Charges\ChargesContext as C;
use Tests\Feature\Leases\LeasesContext as L;

beforeEach(function (): void {
    C::preparer($this);
});

it('relit les faits d\'une pièce comptabilisée : bien, lot, catégorie, part récupérable, règlement', function (): void {
    $scene = C::autonome();
    C::comme($this, $scene['owner']);
    $id = C::depense($this, $scene, ['category_term_id' => C::categorie('property_tax'), 'total_gross' => 90000, 'recoverable_amount' => 15000])->assertCreated()->json('data.id');

    $faits = L::dans($scene['org'], fn (): array => app(ExpenseFacts::class)->byIds([$id, (string) Str::uuid7()]));

    expect($faits)->toHaveCount(1)
        ->and($faits[$id]->propertyId)->toBe($scene['property'])
        ->and($faits[$id]->unitId)->toBe($scene['unit']->id)
        ->and($faits[$id]->kind)->toBe('payment')
        ->and($faits[$id]->categoryTermId)->toBe(C::categorie('property_tax'))
        ->and($faits[$id]->gross->getAmount())->toBe('90000')
        ->and($faits[$id]->recoverable->getAmount())->toBe('15000')
        ->and($faits[$id]->status)->toBe('recorded');
});

it('ne lit pas la pièce d\'une autre organisation', function (): void {
    $a = C::autonome();
    C::comme($this, $a['owner']);
    $id = C::depense($this, $a)->assertCreated()->json('data.id');
    $b = C::autonome();

    expect(L::dans($b['org'], fn (): array => app(ExpenseFacts::class)->byIds([$id])))->toBe([]);
});

it('liste les relevés du syndic dont le service commence dans l\'intervalle semi-ouvert', function (): void {
    $scene = C::agence();
    C::comme($this, $scene['owner']);
    $corps = ['kind' => 'co_ownership_statement', 'settlement' => 'none', 'category_term_id' => C::categorie('co_ownership'), 'recoverable_rubric' => 'building_equipment', 'paid_on' => null];
    $releve = C::depense($this, $scene, [...$corps, 'document_on' => '2026-06-30', 'service_from' => '2025-01-01', 'service_to' => '2026-01-01'])->assertCreated()->json('data.id');
    C::depense($this, $scene, [...$corps, 'document_on' => '2026-11-10', 'service_from' => '2026-01-01', 'service_to' => '2027-01-01', 'reference' => 'REL-2026'])->assertCreated();

    $lire = fn (string $de, string $a, ?array $lots = null): array => L::dans($scene['org'], fn (): array => app(ExpenseFacts::class)->coOwnershipStatements(CarbonImmutable::parse($de), CarbonImmutable::parse($a), $lots));

    expect(array_column($lire('2025-01-01', '2026-01-01'), 'id'))->toBe([$releve])
        ->and($lire('2025-01-02', '2026-01-01'))->toBe([])
        ->and($lire('2025-01-01', '2025-01-01'))->toBe([])
        ->and($lire('2025-01-01', '2027-01-01', []))->toBe([])
        ->and($lire('2025-01-01', '2027-01-01'))->toHaveCount(2);
});
