<?php

declare(strict_types=1);

use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Tests\Feature\Leases\LeasesContext as L;
use Tests\Feature\Leases\LeasesReadContext as R;

beforeEach(function (): void {
    L::semer();
    $this->org = L::organisation();
    $this->titulaire = L::titulaire($this->org);
    $this->travelTo(CarbonImmutable::parse('2026-11-16 10:00:00'));
    $this->actingAs($this->titulaire);
    $this->semer = function (int $nombre, string $prefixe): void {
        foreach (range(1, $nombre) as $i) {
            $bail = R::bailSigne($this->org, ['reference' => sprintf('BL-%s-%03d', $prefixe, $i), 'starts_on' => '2026-01-01', 'ends_on' => '2029-01-01']);
            R::occuper($this->org, $bail, L::lot($this->org), ['valid_from' => '2026-01-01']);
            R::lier($this->org, $bail, L::partie($this->org), ['valid_from' => '2026-01-01']);
            R::terme($this->org, $bail, 'rent', [...R::loyer(65000), 'valid_from' => '2026-01-01']);
            R::terme($this->org, $bail, 'charges_provision', ['valid_from' => '2026-01-01']);
        }
    };
    $this->requetes = function (string $requete): int {
        DB::flushQueryLog();
        DB::enableQueryLog();
        $this->getJson(R::url($this->org, $requete))->assertOk();
        $total = count(array_filter(DB::getQueryLog(), fn (array $r): bool => ! str_contains((string) $r['query'], 'from "properties"')));
        DB::disableQueryLog();

        return $total;
    };
});

it('liste les baux en un nombre de requêtes borné, indépendant du nombre de baux (hors lecture des immeubles, propre au module Properties)', function (): void {
    ($this->semer)(2, '2026-A');
    $peu = ($this->requetes)('?per_page=100');

    ($this->semer)(10, '2026-B');
    $beaucoup = ($this->requetes)('?per_page=100');

    expect($beaucoup)->toBe($peu)
        ->and($beaucoup)->toBeLessThanOrEqual(20);
});

it('garde la même borne sur une page de taille réduite', function (): void {
    ($this->semer)(12, '2026-C');

    expect(($this->requetes)('?per_page=3'))->toBe(($this->requetes)('?per_page=12'));
});
