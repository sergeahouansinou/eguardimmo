<?php

declare(strict_types=1);

use Illuminate\Support\Facades\DB;
use Tests\Feature\Mandates\MandatesContext as M;
use Tests\Feature\Rent\RentContext as C;
use Tests\Feature\Reporting\ReportingContext as R;

function requetesGeneration(Closure $appel): int
{
    DB::flushQueryLog();
    DB::enableQueryLog();
    $appel();
    $n = count(DB::getQueryLog());
    DB::disableQueryLog();

    return $n;
}

it('la génération fait un nombre constant de requêtes, quel que soit le nombre de lots et de baux du mandant', function (): void {
    ['org' => $this->org, 'bail' => $this->bail, 'mandant' => $this->mandant] = R::agence($this);
    R::parcours($this);
    $id = R::rapport($this);

    $generer = fn (): int => requetesGeneration(fn () => $this->postJson(R::url($this->org, "/management-reports/{$id}/generate"))->assertOk());
    $generer();
    $avant = $generer();

    foreach (range(1, 4) as $i) {
        ['bail' => $bail2, 'lot' => $lot2] = C::bail($this->org);
        M::actif($this->org, $lot2, $this->mandant);
        C::emises($this->org, $bail2, $this);
    }

    $generer();

    expect($generer())->toBe($avant);
});
