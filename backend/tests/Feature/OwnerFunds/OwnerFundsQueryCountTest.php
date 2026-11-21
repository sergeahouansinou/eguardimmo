<?php

declare(strict_types=1);

use Illuminate\Support\Facades\DB;
use Tests\Feature\OwnerFunds\OwnerFundsContext as F;

function requetes(Closure $appel): int
{
    DB::flushQueryLog();
    DB::enableQueryLog();
    $appel();
    $n = count(DB::getQueryLog());
    DB::disableQueryLog();

    return $n;
}

it('les listes et le détail d\'un lot font un nombre constant de requêtes, quel que soit le nombre de lignes', function (): void {
    ['org' => $org, 'bail' => $bail, 'mandant' => $mandant] = F::agence($this);
    F::encaisserEtCloturer($this, $org, $bail);
    $lot = F::envoyer($this, 'POST', F::url($org, '/batches'), ['mandant_ids' => [$mandant->id]])->assertCreated()->json('data.id');
    F::envoyer($this, 'POST', F::url($org, '/holds'), ['mandant_party_id' => $mandant->id, 'kind' => 'reserve', 'amount' => 100, 'reason' => 'other'])->assertCreated();

    $mesure = fn (): array => [
        requetes(fn () => $this->getJson(F::url($org, '/holds'))->assertOk()),
        requetes(fn () => $this->getJson(F::url($org, '/batches'))->assertOk()),
        requetes(fn () => $this->getJson(F::url($org, "/batches/{$lot}"))->assertOk()),
    ];
    $mesure();
    $avant = $mesure();

    foreach (range(1, 6) as $i) {
        F::envoyer($this, 'POST', F::url($org, '/holds'), ['mandant_party_id' => $mandant->id, 'kind' => 'reserve', 'amount' => 100 + $i, 'reason' => 'other'])->assertCreated();
    }

    expect($mesure())->toBe($avant);
});
