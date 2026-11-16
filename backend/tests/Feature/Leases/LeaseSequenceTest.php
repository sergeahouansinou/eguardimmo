<?php

declare(strict_types=1);

use App\Modules\Leases\Support\LeaseSequence;
use Illuminate\Support\Facades\DB;
use Tests\Feature\Leases\LeasesContext as L;

beforeEach(function (): void {
    $this->org = L::organisation();
    $this->suite = fn (int $annee, int $fois = 3, $org = null): array => L::dans($org ?? $this->org, fn (): array => array_map(
        fn (): string => app(LeaseSequence::class)->next($annee),
        range(1, $fois),
    ));
});

it('numérote BL-AAAA-NNNN de 1 sans trou', function (): void {
    expect(($this->suite)(2026))->toBe(['BL-2026-0001', 'BL-2026-0002', 'BL-2026-0003'])
        ->and(($this->suite)(2026, 1))->toBe(['BL-2026-0004']);
});

it('repart de 1 à chaque année, sans toucher aux autres', function (): void {
    ($this->suite)(2026);

    expect(($this->suite)(2027, 2))->toBe(['BL-2027-0001', 'BL-2027-0002'])
        ->and(($this->suite)(2026, 1))->toBe(['BL-2026-0004']);
});

it('compte séparément chaque organisation', function (): void {
    ($this->suite)(2026);

    expect(($this->suite)(2026, 2, L::organisation()))->toBe(['BL-2026-0001', 'BL-2026-0002'])
        ->and(DB::table('lease_sequences')->count())->toBe(2);
});

it('dépasse quatre chiffres sans casser la référence', function (): void {
    DB::table('lease_sequences')->insert(['organization_id' => $this->org->id, 'year' => 2026, 'last_value' => 9999]);

    expect(($this->suite)(2026, 2))->toBe(['BL-2026-10000', 'BL-2026-10001']);
});

it('libère le numéro quand la transaction est annulée', function (): void {
    ($this->suite)(2026, 1);

    try {
        DB::transaction(function (): void {
            ($this->suite)(2026, 1);

            throw new RuntimeException('annulation');
        });
    } catch (RuntimeException) {
    }

    expect(($this->suite)(2026, 1))->toBe(['BL-2026-0002']);
});
