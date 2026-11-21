<?php

declare(strict_types=1);

use App\Modules\Charges\Actions\ComputeExercise;
use Illuminate\Support\Facades\DB;
use Tests\Feature\Charges\ChargesContext as C;
use Tests\Feature\Charges\ExercisesContext as E;
use Tests\Feature\Leases\LeasesContext as L;

beforeEach(function (): void {
    C::preparer($this);
});

function requetesDuCalcul(object $test, int $baux): int
{
    $test->travelTo('2026-11-16');
    $scene = E::sceneVide();

    for ($i = 0; $i < $baux; $i++) {
        E::bailSurLot($scene['org'], $i === 0 ? $scene['unit'] : E::lot($scene['org'], $scene['property']), ['starts_on' => '2026-01-01']);
    }

    C::comme($test, $scene['owner']);
    $cle = E::cle($test, $scene, 'surface')->assertCreated()->json('data.id');
    $exercice = E::exerciceAvecPoste($test, $scene, E::depense($test, $scene), 80000, ['key_id' => $cle]);

    return L::dans($scene['org'], function () use ($exercice): int {
        DB::flushQueryLog();
        DB::enableQueryLog();
        $resultat = app(ComputeExercise::class)->handle($exercice);
        $nombre = count(DB::getQueryLog());
        DB::disableQueryLog();

        expect($resultat->statements)->toBeGreaterThan(0);

        return $nombre;
    });
}

it('le calcul garde le même nombre de requêtes quel que soit le nombre de baux', function (): void {
    $petit = requetesDuCalcul($this, 2);
    $grand = requetesDuCalcul($this, 12);

    expect($petit)->toBeGreaterThan(10)->and($grand)->toBe($petit);
});

it('un bail sous mandat dont les provisions ne sont pas routées vers un mandant bloque le calcul', function (): void {
    $scene = C::agence();
    C::comme($this, $scene['owner']);
    $exercice = E::exerciceAvecPoste($this, $scene, E::depense($this, $scene), 80000, ['unit_id' => $scene['unit']->id]);

    E::calculer($this, $scene, $exercice)->assertStatus(409)->assertJsonPath('code', 'charges_owner_funds_not_ready');
});

it('un bail sous mandat dont les provisions sont routées porte le mandant sur le décompte', function (): void {
    $scene = C::agence();
    C::activerFonds($scene['org']);
    E::appeler($this, $scene['org'], $scene['lease'], 3);
    C::comme($this, $scene['owner']);
    $exercice = E::exerciceAvecPoste($this, $scene, E::depense($this, $scene), 80000, ['unit_id' => $scene['unit']->id]);

    E::calculer($this, $scene, $exercice)->assertOk()
        ->assertJsonPath('data.statements.0.mandant_party_id', $scene['mandant']->id)
        ->assertJsonPath('data.statements.0.provisions_called.amount', 15000);
});
