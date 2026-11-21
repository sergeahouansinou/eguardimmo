<?php

declare(strict_types=1);

use Illuminate\Support\Facades\DB;
use Tests\Feature\Banking\BankingContext as B;

function bkRequetes(Closure $appel): int
{
    DB::flushQueryLog();
    DB::enableQueryLog();
    $appel();
    $n = count(DB::getQueryLog());
    DB::disableQueryLog();

    return $n;
}

it('les listes font un nombre constant de requêtes quel que soit le nombre de lignes', function (): void {
    ['org' => $org, 'compte' => $compte] = B::loyers($this);
    $lot = static fn (int $de, int $n): string => B::csv(array_map(fn (int $i): array => ['02/11/2026', "LIGNE {$i}", '1,00'], range($de, $de + $n - 1)), 'L'.$de.'-');
    B::importer($this, $org, $compte, $lot(1, 5))->assertCreated();

    $mesure = fn (): array => [
        bkRequetes(fn () => $this->getJson(B::url($org, '/lines?per_page=100'))->assertOk()),
        bkRequetes(fn () => $this->getJson(B::url($org, '/statements'))->assertOk()),
        bkRequetes(fn () => $this->getJson(B::url($org, '/accounts'))->assertOk()),
        bkRequetes(fn () => $this->getJson(B::url($org, "/book-lines?account_id={$compte}"))->assertOk()),
    ];
    $mesure();
    $avant = $mesure();

    B::importer($this, $org, $compte, $lot(100, 60))->assertCreated();

    expect($mesure())->toBe($avant);
});
