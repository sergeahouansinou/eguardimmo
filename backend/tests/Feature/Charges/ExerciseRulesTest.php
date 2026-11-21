<?php

declare(strict_types=1);

use App\Modules\Properties\Models\Property;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\Feature\Charges\ChargesContext as C;
use Tests\Feature\Charges\ExercisesContext as E;
use Tests\Feature\Leases\LeasesContext as L;

beforeEach(function (): void {
    C::preparer($this);
});

function cleSurface(object $test, array $scene): string
{
    return E::cle($test, $scene, 'surface')->assertCreated()->json('data.id');
}

it('refuse une période hors règle : fin future, plus de douze mois, fin avant début', function (array $periode, int $statut, string $code): void {
    $scene = E::scene($this);
    C::comme($this, $scene['owner']);

    E::exercice($this, $scene, $periode)->assertStatus($statut)->assertJsonPath('code', $code);
})->with([
    'fin dans le futur' => [['period_start' => '2026-06-01', 'period_end' => '2026-12-01'], 422, 'charge_exercise_period_invalid'],
    'treize mois' => [['period_start' => '2025-01-01', 'period_end' => '2026-02-01'], 422, 'charge_exercise_period_invalid'],
    'fin avant début' => [['period_start' => '2026-06-01', 'period_end' => '2026-05-01'], 422, 'validation_failed'],
]);

it('refuse le chevauchement d\'un exercice du même bien ; un exercice écarté libère la période', function (): void {
    $scene = E::scene($this);
    C::comme($this, $scene['owner']);
    $premier = E::exercice($this, $scene)->assertCreated()->json('data.id');

    E::exercice($this, $scene, ['period_start' => '2026-10-01', 'period_end' => '2026-11-01'])->assertStatus(409)->assertJsonPath('code', 'charge_exercise_overlap');
    E::exercice($this, $scene, ['period_start' => '2025-01-01', 'period_end' => '2026-01-01'])->assertCreated();

    $this->postJson(C::url($scene['org'], "/exercises/{$premier}/discard"))->assertOk()->assertJsonPath('data.status', 'discarded');
    $this->postJson(C::url($scene['org'], "/exercises/{$premier}/discard"))->assertOk();
    E::exercice($this, $scene, ['period_start' => '2026-10-01', 'period_end' => '2026-11-01'])->assertCreated();
});

it('refuse une juridiction sans règles de régularisation, sans repli', function (): void {
    $scene = E::sceneVide();
    $belge = L::dans($scene['org'], fn (): Property => Property::factory()->create(['address' => ['line1' => '1 rue Royale', 'postal_code' => '1000', 'city' => 'Bruxelles', 'country' => 'BE']]));
    E::lot($scene['org'], $belge->id);
    C::comme($this, $scene['owner']);

    E::exercice($this, [...$scene, 'property' => $belge->id])->assertStatus(422)->assertJsonPath('code', 'charges_jurisdiction_unsupported');
});

it('la source ne peut pas être retenue au-delà de sa part récupérable, sur les exercices non écartés', function (): void {
    $scene = E::scene($this);
    C::comme($this, $scene['owner']);
    $cle = cleSurface($this, $scene);
    $depense = E::depense($this, $scene, 100000);
    $premier = E::exerciceAvecPoste($this, $scene, $depense, 80000, ['key_id' => $cle]);
    $poste = fn (int $montant): array => E::poste('Ascenseur', 'elevators', ['kind' => 'expense', 'id' => $depense, 'amount' => $montant], ['key_id' => $cle]);
    $autre = ['period_start' => '2025-01-01', 'period_end' => '2026-01-01'];

    E::exercice($this, $scene, [...$autre, 'items' => [$poste(30000)]])->assertStatus(409)->assertJsonPath('code', 'charge_source_exhausted');
    $deuxieme = E::exercice($this, $scene, [...$autre, 'items' => [$poste(20000)]])->assertCreated()->json('data.id');
    $this->patchJson(C::url($scene['org'], "/exercises/{$premier}"), ['lock_version' => 1, 'items' => [$poste(80000)]])->assertOk();
    $this->patchJson(C::url($scene['org'], "/exercises/{$deuxieme}"), ['lock_version' => 1, 'items' => [$poste(30000)]])->assertStatus(409)->assertJsonPath('code', 'charge_source_exhausted');

    $this->postJson(C::url($scene['org'], "/exercises/{$premier}/discard"))->assertOk();
    $this->patchJson(C::url($scene['org'], "/exercises/{$deuxieme}"), ['lock_version' => 1, 'items' => [$poste(30000)]])->assertOk();
});

it('rejette un poste invalide : rubrique non récupérable, source étrangère, montant au-dessus de la part, lot étranger', function (array $poste, string $code): void {
    $scene = E::scene($this);
    $etranger = E::sceneVide();
    C::comme($this, $scene['owner']);
    $depense = E::depense($this, $scene, 50000);
    $base = ['label' => 'Poste', 'rubric' => 'elevators', 'unit_id' => $scene['unit']->id, 'sources' => [['kind' => 'expense', 'id' => $depense, 'amount' => 50000]]];

    $corps = $poste === [] ? [] : $poste;
    $corps = array_replace_recursive($base, array_map(fn (mixed $v): mixed => $v === '@etranger' ? $etranger['unit']->id : $v, $corps));
    E::exercice($this, $scene, ['items' => [$corps]])->assertStatus(422)->assertJsonPath('code', $code);
})->with([
    'rubrique non récupérable' => [['rubric' => 'management_fees'], 'charge_item_invalid'],
    'montant au-dessus de la part' => [['sources' => [['amount' => 50001]]], 'charge_item_invalid'],
    'lot d\'un autre bien' => [['unit_id' => '@etranger'], 'charge_item_invalid'],
    'ni clé ni lot' => [['unit_id' => null], 'charge_item_invalid'],
]);

it('une clé qui change pendant la période, ou qui ne couvre pas un lot occupé, bloque le calcul', function (): void {
    $scene = E::scene($this);
    $b = E::lot($scene['org'], $scene['property']);
    C::comme($this, $scene['owner']);
    $depense = E::depense($this, $scene);

    $change = E::cle($this, $scene, 'tantiemes', ['shares' => [['unit_id' => $scene['unit']->id, 'weight' => 64], ['unit_id' => $b->id, 'weight' => 936]]])->assertCreated()->json('data.id');
    $this->postJson(C::url($scene['org'], "/properties/{$scene['property']}/charge-keys/{$change}/versions"), ['valid_from' => '2026-06-01', 'shares' => [['unit_id' => $scene['unit']->id, 'weight' => 70], ['unit_id' => $b->id, 'weight' => 930]]])->assertCreated();
    $exercice = E::exerciceAvecPoste($this, $scene, $depense, 40000, ['key_id' => $change]);
    E::calculer($this, $scene, $exercice)->assertStatus(422)->assertJsonPath('code', 'charge_key_changed_during_period');

    $incomplete = E::cle($this, $scene, 'tantiemes', ['shares' => [['unit_id' => $b->id, 'weight' => 100]]])->assertCreated()->json('data.id');
    $this->postJson(C::url($scene['org'], "/exercises/{$exercice}/discard"))->assertOk();
    $deux = E::exercice($this, $scene, ['items' => [E::poste('Ascenseur', 'elevators', ['kind' => 'expense', 'id' => $depense, 'amount' => 40000], ['key_id' => $incomplete])]])->assertCreated()->json('data.id');
    E::calculer($this, $scene, $deux)->assertStatus(422)->assertJsonPath('code', 'charge_key_incomplete');

    $tardive = E::cle($this, $scene, 'surface', ['valid_from' => '2026-03-01'])->assertCreated()->json('data.id');
    $this->patchJson(C::url($scene['org'], "/exercises/{$deux}"), ['lock_version' => 1, 'items' => [E::poste('Ascenseur', 'elevators', ['kind' => 'expense', 'id' => $depense, 'amount' => 40000], ['key_id' => $tardive])]])->assertOk();
    E::calculer($this, $scene, $deux)->assertStatus(422)->assertJsonPath('code', 'charge_key_incomplete');
});

it('une clé archivée ne sert plus à un nouveau poste', function (): void {
    $scene = E::scene($this);
    C::comme($this, $scene['owner']);
    $cle = cleSurface($this, $scene);
    $this->postJson(C::url($scene['org'], "/properties/{$scene['property']}/charge-keys/{$cle}/archive"))->assertOk();

    $poste = E::poste('Ascenseur', 'elevators', ['kind' => 'expense', 'id' => E::depense($this, $scene), 'amount' => 1000], ['key_id' => $cle]);
    E::exercice($this, $scene, ['items' => [$poste]])->assertStatus(409)->assertJsonPath('code', 'charge_key_archived');
});

it('un bail d\'un régime non couvert bloque le calcul', function (): void {
    $this->travelTo('2026-11-16');
    $scene = E::sceneVide();
    E::bailSurLot($scene['org'], $scene['unit'], ['starts_on' => '2026-01-01', 'regime_key' => 'fr.commercial.3-6-9']);
    C::comme($this, $scene['owner']);
    $exercice = E::exerciceAvecPoste($this, $scene, E::depense($this, $scene), 1000, ['unit_id' => $scene['unit']->id]);

    E::calculer($this, $scene, $exercice)->assertStatus(422)->assertJsonPath('code', 'charges_regime_unsupported');
});

it('calcul sans poste refusé ; exercice écarté ou figé non modifiable ; version périmée refusée', function (): void {
    $scene = E::scene($this);
    C::comme($this, $scene['owner']);
    $vide = E::exercice($this, $scene)->assertCreated()->json('data.id');

    E::calculer($this, $scene, $vide)->assertStatus(422)->assertJsonPath('code', 'charge_item_invalid');
    $this->patchJson(C::url($scene['org'], "/exercises/{$vide}"), ['lock_version' => 9, 'period_end' => '2026-10-01', 'items' => []])->assertStatus(409)->assertJsonPath('code', 'charges_stale_version');
    $this->patchJson(C::url($scene['org'], "/exercises/{$vide}"), ['lock_version' => 1, 'period_end' => '2026-10-01'])->assertStatus(422)->assertJsonPath('code', 'charge_item_invalid');
    $this->patchJson(C::url($scene['org'], "/exercises/{$vide}"), ['lock_version' => 1, 'period_end' => '2026-10-01', 'items' => []])->assertOk()->assertJsonPath('data.period_end', '2026-10-01');

    DB::table('charge_exercises')->where('id', $vide)->update(['status' => 'issuing']);
    E::calculer($this, $scene, $vide)->assertStatus(409)->assertJsonPath('code', 'charge_exercise_state_invalid');
    $this->postJson(C::url($scene['org'], "/exercises/{$vide}/discard"))->assertStatus(409)->assertJsonPath('code', 'charge_exercise_state_invalid');
});

it('remplacer les postes écarte l\'aperçu calculé ; écarter l\'exercice le supprime', function (): void {
    $scene = E::scene($this);
    C::comme($this, $scene['owner']);
    $depense = E::depense($this, $scene);
    $exercice = E::exerciceAvecPoste($this, $scene, $depense, 80000, ['unit_id' => $scene['unit']->id]);
    E::calculer($this, $scene, $exercice)->assertOk();
    $version = (int) DB::table('charge_exercises')->where('id', $exercice)->value('lock_version');

    $this->patchJson(C::url($scene['org'], "/exercises/{$exercice}"), ['lock_version' => $version, 'items' => [E::poste('Nettoyage', 'common_interior', ['kind' => 'expense', 'id' => $depense, 'amount' => 70000], ['unit_id' => $scene['unit']->id])]])
        ->assertOk()->assertJsonPath('data.status', 'draft')->assertJsonPath('data.statements', [])->assertJsonPath('data.items.0.amount.amount', 70000);

    E::calculer($this, $scene, $exercice)->assertOk();
    $this->postJson(C::url($scene['org'], "/exercises/{$exercice}/discard"))->assertOk();

    expect(E::decomptes($scene['org'], $exercice))->toBe([]);
});

it('journalise la création, le calcul et l\'écart sans montant', function (): void {
    $scene = E::scene($this);
    C::comme($this, $scene['owner']);
    $exercice = E::exerciceAvecPoste($this, $scene, E::depense($this, $scene), 80000, ['unit_id' => $scene['unit']->id]);
    E::calculer($this, $scene, $exercice)->assertOk();
    $this->postJson(C::url($scene['org'], "/exercises/{$exercice}/discard"))->assertOk();

    $actions = DB::table('audit_logs')->where('subject_id', $exercice)->pluck('action')->all();

    expect($actions)->toContain('charges.exercise.created', 'charges.exercise.computed', 'charges.exercise.discarded');
});

it('liste et filtre les exercices du bien, avec curseur', function (): void {
    $scene = E::scene($this);
    C::comme($this, $scene['owner']);
    $a = E::exercice($this, $scene)->assertCreated()->json('data.id');
    $b = E::exercice($this, $scene, ['period_start' => '2025-01-01', 'period_end' => '2026-01-01'])->assertCreated()->json('data.id');
    $this->postJson(C::url($scene['org'], "/exercises/{$b}/discard"))->assertOk();

    $this->getJson(C::url($scene['org'], '/exercises?property_id='.$scene['property']))->assertOk()->assertJsonCount(2, 'data');
    $this->getJson(C::url($scene['org'], '/exercises?status=discarded'))->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $b);
    $this->getJson(C::url($scene['org'], '/exercises?per_page=1'))->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $b);
});

it('le grand livre fige les décomptes émis et les postes d\'un exercice figé (déclencheurs)', function (): void {
    $scene = E::scene($this);
    C::comme($this, $scene['owner']);
    $exercice = E::exerciceAvecPoste($this, $scene, E::depense($this, $scene), 80000, ['unit_id' => $scene['unit']->id]);
    E::calculer($this, $scene, $exercice)->assertOk();
    $decompte = E::decomptes($scene['org'], $exercice)[0]['id'];

    DB::table('charge_statements')->where('id', $decompte)->update(['status' => 'issued', 'number' => 'DC-2026-0001']);

    expect(fn () => DB::table('charge_statements')->where('id', $decompte)->update(['share_total' => 1]))->toThrow(QueryException::class)
        ->and(fn () => DB::table('charge_statements')->where('id', $decompte)->delete())->toThrow(QueryException::class)
        ->and(fn () => DB::table('charge_statements')->where('id', $decompte)->update(['status' => 'computed']))->toThrow(QueryException::class)
        ->and(fn () => DB::table('charge_statement_lines')->where('statement_id', $decompte)->delete())->toThrow(QueryException::class)
        ->and(fn () => DB::table('charge_statement_lines')->where('statement_id', $decompte)->update(['share' => 1]))->toThrow(QueryException::class);

    DB::table('charge_exercises')->where('id', $exercice)->update(['status' => 'issued']);

    expect(fn () => DB::table('charge_items')->where('exercise_id', $exercice)->update(['amount' => 1]))->toThrow(QueryException::class)
        ->and(fn () => DB::table('charge_items')->where('exercise_id', $exercice)->delete())->toThrow(QueryException::class);

    DB::table('charge_statements')->where('id', $decompte)->update(['status' => 'superseded']);
    expect(DB::table('charge_statements')->where('id', $decompte)->value('status'))->toBe('superseded');
});

it('plafonne à 500 le nombre total de sources d\'une requête, avec une erreur 422 claire', function (): void {
    $scene = E::sceneVide();
    C::comme($this, $scene['owner']);
    $postes = fn (int $nombre): array => array_map(fn (int $i): array => [...E::poste("Poste {$i}", 'elevators', ['kind' => 'expense', 'id' => (string) Str::uuid7(), 'amount' => 100], ['unit_id' => $scene['unit']->id]), 'sources' => array_map(fn (): array => ['kind' => 'expense', 'id' => (string) Str::uuid7(), 'amount' => 100], range(1, 100))], range(1, $nombre));

    $refus = E::exercice($this, $scene, ['items' => [...$postes(5), E::poste('Poste de trop', 'elevators', ['kind' => 'expense', 'id' => (string) Str::uuid7(), 'amount' => 100], ['unit_id' => $scene['unit']->id])]])->assertStatus(422);

    expect($refus->json('code'))->toBe('validation_failed')->and(json_encode($refus->json()))->toContain('500 sources');
    E::exercice($this, $scene, ['items' => $postes(5)])->assertStatus(422)->assertJsonPath('code', 'charge_item_invalid');
});
