<?php

declare(strict_types=1);

use App\Shared\Database\ContinuousCounter;
use Illuminate\Support\Facades\DB;
use Tests\Feature\Documents\DocumentsContext as D;

beforeEach(function (): void {
    $this->org = D::organisation();
    $this->compteur = app(ContinuousCounter::class);
    $this->suite = fn (string $organisation, string $type, int $fois = 3): array => array_map(
        fn (): int => $this->compteur->next('document_sequences', ['organization_id' => $organisation, 'type' => $type]),
        range(1, $fois),
    );
});

it('numérote de 1 sans trou, séparément pour chaque clé', function (): void {
    $autre = D::organisation();

    expect(($this->suite)($this->org->id, 'invoice'))->toBe([1, 2, 3])
        ->and(($this->suite)($this->org->id, 'letter'))->toBe([1, 2, 3])
        ->and(($this->suite)($autre->id, 'invoice'))->toBe([1, 2, 3])
        ->and(($this->suite)($this->org->id, 'invoice', 1))->toBe([4])
        ->and(DB::table('document_sequences')->count())->toBe(3);
});

it('accepte une clé primaire composée de colonnes entières', function (): void {
    $suite = fn (int $annee): array => array_map(fn (): int => $this->compteur->next('journal_entry_counters', ['organization_id' => $this->org->id, 'fiscal_year' => $annee]), range(1, 2));

    expect($suite(2026))->toBe([1, 2])->and($suite(2027))->toBe([1, 2]);
});

it('libère le numéro quand la transaction est annulée', function (): void {
    ($this->suite)($this->org->id, 'invoice', 1);

    try {
        DB::transaction(function (): void {
            ($this->suite)($this->org->id, 'invoice', 1);

            throw new RuntimeException('annulation');
        });
    } catch (RuntimeException) {
    }

    expect(($this->suite)($this->org->id, 'invoice', 1))->toBe([2]);
});
