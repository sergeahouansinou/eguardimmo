<?php

declare(strict_types=1);

use Illuminate\Support\Facades\DB;
use Tests\Feature\Charges\ChargesContext as C;
use Tests\Feature\Charges\ExercisesContext as E;
use Tests\Feature\Leases\LeasesContext as L;

beforeEach(function (): void {
    C::preparer($this);
});

/**
 * Dépense de 1 200 répartie 600 / 600 sur deux exercices ; le premier est émis, le second reste ouvert.
 *
 * @return array{scene: array<string, mixed>, depense: string, premier: string, second: string, decompte: array<string, mixed>}
 */
function scenePartagee(object $test): array
{
    $scene = E::scene($test);
    C::comme($test, $scene['owner']);
    $depense = E::depense($test, $scene, 120000);
    $cible = ['unit_id' => $scene['unit']->id];
    $premier = E::exerciceAvecPoste($test, $scene, $depense, 60000, $cible, ['period_start' => '2026-01-01', 'period_end' => '2026-06-01']);
    $second = E::exerciceAvecPoste($test, $scene, $depense, 60000, $cible, ['period_start' => '2026-06-01', 'period_end' => '2026-11-01']);
    E::calculer($test, $scene, $premier)->assertOk();
    $decompte = E::emettre($test, $scene, $premier)->assertOk()->json('data.statements.0');

    return ['scene' => $scene, 'depense' => $depense, 'premier' => $premier, 'second' => $second, 'decompte' => $decompte];
}

function rectifier(object $test, array $p): array
{
    $rectif = $test->postJson(C::url($p['scene']['org'], "/statements/{$p['decompte']['id']}/rectify"), ['reason' => 'Facture corrigée'], ['Idempotency-Key' => 'rectif-'.bin2hex(random_bytes(4))])->assertCreated();

    return ['id' => $rectif->json('data.id'), 'lock' => $rectif->json('data.lock_version')];
}

function corrigerSource(object $test, array $p, array $rectif, int $montant)
{
    $poste = E::poste('Ascenseur', 'elevators', ['kind' => 'expense', 'id' => $p['depense'], 'amount' => $montant], ['unit_id' => $p['scene']['unit']->id]);

    return $test->patchJson(C::url($p['scene']['org'], "/exercises/{$rectif['id']}"), ['lock_version' => $rectif['lock'], 'items' => [$poste]]);
}

it('un rectificatif ne reprend pas ce que les autres exercices retiennent déjà sur la source', function (): void {
    $p = scenePartagee($this);
    $rectif = rectifier($this, $p);

    corrigerSource($this, $p, $rectif, 120000)->assertStatus(409)->assertJsonPath('code', 'charge_source_exhausted');
    corrigerSource($this, $p, $rectif, 60000)->assertOk();
});

it('un rectificatif peut reprendre toute la part de l\'exercice qu\'il corrige quand les autres exercices n\'ont rien retenu', function (): void {
    $scene = E::scene($this);
    C::comme($this, $scene['owner']);
    $depense = E::depense($this, $scene, 120000);
    $premier = E::exerciceAvecPoste($this, $scene, $depense, 60000, ['unit_id' => $scene['unit']->id]);
    E::calculer($this, $scene, $premier)->assertOk();
    $decompte = E::emettre($this, $scene, $premier)->assertOk()->json('data.statements.0');
    $rectif = $this->postJson(C::url($scene['org'], "/statements/{$decompte['id']}/rectify"), ['reason' => 'Facture corrigée'], ['Idempotency-Key' => 'rectif-0001'])->assertCreated();
    $poste = E::poste('Ascenseur', 'elevators', ['kind' => 'expense', 'id' => $depense, 'amount' => 120000], ['unit_id' => $scene['unit']->id]);

    $this->patchJson(C::url($scene['org'], "/exercises/{$rectif->json('data.id')}"), ['lock_version' => $rectif->json('data.lock_version'), 'items' => [$poste]])->assertOk();
});

it('charges:verify signale la double facturation d\'une source par un rectificatif', function (): void {
    $p = scenePartagee($this);
    $rectif = rectifier($this, $p);

    $this->artisan('charges:verify')->expectsOutputToContain('Charges cohérentes.')->assertSuccessful();

    L::dans($p['scene']['org'], fn () => DB::table('charge_item_sources')->where('exercise_id', $rectif['id'])->update(['amount' => 120000]));

    $this->artisan('charges:verify')->expectsOutputToContain('[source_overcap]')->assertFailed();
});

it('le motif d\'un rectificatif n\'entre pas dans le journal d\'audit', function (): void {
    $p = scenePartagee($this);
    $this->postJson(C::url($p['scene']['org'], "/statements/{$p['decompte']['id']}/rectify"), ['reason' => 'Litige confidentiel avec le locataire'], ['Idempotency-Key' => 'rectif-motif'])->assertCreated();

    $journal = DB::table('audit_logs')->get();

    expect($journal->contains(fn (object $l): bool => $l->subject_type === 'charge_exercise' && $l->action !== 'charges.exercise.issuing'))->toBeTrue()
        ->and($journal->toJson())->not->toContain('Litige confidentiel');
});
