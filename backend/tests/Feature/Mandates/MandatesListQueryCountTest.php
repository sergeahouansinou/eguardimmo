<?php

declare(strict_types=1);

use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Tests\Feature\Mandates\MandatesContext as M;

beforeEach(function (): void {
    M::semer();
    $this->org = M::organisation();
    $this->travelTo(CarbonImmutable::parse('2026-11-16 10:00:00'));
    $this->actingAs(M::titulaire($this->org));
    $this->semer = function (int $nombre, string $prefixe): void {
        foreach (range(1, $nombre) as $i) {
            $mandat = M::actif($this->org, M::lot($this->org), M::partie($this->org), ['reference' => sprintf('M-%s-%03d', $prefixe, $i)]);
            M::dans($this->org, fn () => $mandat->units()->create(['unit_id' => M::lot($this->org)->id, 'valid_from' => '2026-01-01']));
        }
    };
    $this->requetes = function (string $requete): int {
        DB::flushQueryLog();
        DB::enableQueryLog();
        $this->getJson(M::url($this->org, $requete))->assertOk();
        $total = count(array_filter(DB::getQueryLog(), fn (array $r): bool => ! str_contains((string) $r['query'], 'from "properties"')));
        DB::disableQueryLog();

        return $total;
    };
});

it('liste les mandats en un nombre de requêtes borné, indépendant du nombre de mandats (hors lecture des immeubles, propre au module Properties)', function (): void {
    ($this->semer)(2, '2026');
    $peu = ($this->requetes)('?per_page=100');

    ($this->semer)(10, '2027');
    $beaucoup = ($this->requetes)('?per_page=100');

    expect($beaucoup)->toBe($peu)->and($beaucoup)->toBeLessThanOrEqual(21);
});

it('garde la même borne sur une page de taille réduite', function (): void {
    ($this->semer)(12, '2028');

    expect(($this->requetes)('?per_page=3'))->toBe(($this->requetes)('?per_page=12'));
});

it('liste les mandants en un nombre de requêtes indépendant du nombre de mandants', function (): void {
    ($this->semer)(2, '2026');
    DB::flushQueryLog();
    DB::enableQueryLog();
    $this->getJson(M::url($this->org, '/mandants'))->assertOk();
    $peu = count(DB::getQueryLog());

    ($this->semer)(8, '2027');
    DB::flushQueryLog();
    $this->getJson(M::url($this->org, '/mandants'))->assertOk();
    $beaucoup = count(DB::getQueryLog());
    DB::disableQueryLog();

    expect($beaucoup)->toBe($peu);
});
