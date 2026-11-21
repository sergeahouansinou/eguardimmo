<?php

declare(strict_types=1);

use Illuminate\Support\Facades\DB;
use Tests\Feature\Leases\LeasesContext as L;
use Tests\Feature\Rent\RentContext as C;

beforeEach(function (): void {
    C::preparer($this);
    $this->org = C::organisation();
    $this->semer = function (int $nombre): void {
        foreach (range(1, $nombre) as $i) {
            ['bail' => $bail] = C::bail($this->org);
            C::emises($this->org, $bail, $this);
            C::payer($this, $this->org, $bail, 20000)->assertCreated();
        }
    };
    $this->requetes = function (string $chemin): int {
        DB::flushQueryLog();
        DB::enableQueryLog();
        $this->getJson(C::url($this->org, $chemin))->assertOk();
        $total = count(array_filter(DB::getQueryLog(), fn (array $r): bool => ! str_contains((string) $r['query'], 'from "properties"')));
        DB::disableQueryLog();

        return $total;
    };
});

it('liste les échéances, encaissements et quittances en un nombre de requêtes indépendant du nombre de lignes', function (): void {
    ($this->semer)(2);
    $this->actingAs(L::titulaire($this->org));
    $peu = ['/installments?per_page=100' => ($this->requetes)('/installments?per_page=100'), '/payments?per_page=100' => ($this->requetes)('/payments?per_page=100'), '/receipts?per_page=100' => ($this->requetes)('/receipts?per_page=100')];

    ($this->semer)(8);
    $this->actingAs(L::titulaire($this->org));

    foreach ($peu as $chemin => $nombre) {
        expect(($this->requetes)($chemin))->toBe($nombre, $chemin);
    }

    $this->getJson(C::url($this->org, '/installments?per_page=100'))->assertJsonCount(10, 'data');
});
