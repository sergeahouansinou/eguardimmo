<?php

declare(strict_types=1);

use App\Modules\Leases\PublicApi\LeaseSchedule;
use Carbon\CarbonImmutable;
use Tests\Feature\Leases\LeasesContext as L;
use Tests\Feature\Leases\LeasesReadContext as R;

beforeEach(function (): void {
    L::semer();
    $this->du = CarbonImmutable::parse('2026-11-16');
    $this->au = CarbonImmutable::parse('2026-12-16');
    $this->organisations = fn (): array => app(LeaseSchedule::class)->organizationsWithActiveLeases($this->du, $this->au);
});

it('donne les organisations qui ont un bail signé en cours, sans contexte d\'organisation, une seule fois chacune', function (): void {
    $a = L::organisation();
    $b = L::organisation();
    R::bailSigne($a, ['starts_on' => '2026-01-01', 'ends_on' => '2029-01-01']);
    R::bailSigne($a, ['starts_on' => '2026-06-01', 'ends_on' => null]);
    R::bailSigne($b, ['starts_on' => '2026-11-20', 'ends_on' => '2029-11-20']);
    $attendu = [$a->id, $b->id];
    sort($attendu);

    expect(($this->organisations)())->toBe($attendu);
});

it('écarte les brouillons, les baux terminés, à venir au-delà de la fenêtre ou archivés', function (): void {
    $org = L::organisation();
    L::bail($org, ['starts_on' => '2026-01-01', 'ends_on' => '2029-01-01']);
    R::bailSigne($org, ['starts_on' => '2024-01-01', 'ends_on' => '2025-01-01']);
    R::bailSigne($org, ['starts_on' => '2027-03-01', 'ends_on' => '2030-03-01']);
    R::bailSigne($org, ['starts_on' => '2026-01-01', 'ends_on' => '2029-01-01', 'archived_at' => '2026-10-01 10:00:00']);

    expect(($this->organisations)())->toBe([]);
});
