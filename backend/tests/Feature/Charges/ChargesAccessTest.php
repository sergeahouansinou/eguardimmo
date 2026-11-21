<?php

declare(strict_types=1);

use App\Modules\Organizations\Enums\MemberRole;
use Illuminate\Support\Facades\DB;
use Tests\Feature\Charges\ChargesContext as C;
use Tests\Feature\Charges\ExercisesContext as E;
use Tests\Feature\Leases\LeasesContext as L;

beforeEach(function (): void {
    C::preparer($this);
});

/**
 * Organisation A : un exercice émis, son décompte et sa pièce, une clé de répartition, une dépense et sa pièce.
 *
 * @return array{scene: array<string, mixed>, exercice: string, decompte: array<string, mixed>, cle: string, depense: string, piece: string, pieceDepense: string}
 */
function organisationEmise(object $test): array
{
    ['scene' => $scene, 'exercice' => $exercice] = E::calcule($test, 8000);
    $decompte = E::emettre($test, $scene, $exercice)->assertOk()->json('data.statements.0');
    $cle = E::cle($test, $scene, 'equal')->assertCreated()->json('data.id');
    $depense = DB::table('charge_item_sources')->where('exercise_id', $exercice)->value('source_id');

    return [
        'scene' => $scene, 'exercice' => $exercice, 'decompte' => $decompte, 'cle' => $cle, 'depense' => $depense,
        'piece' => L::dans($scene['org'], fn () => DB::table('charge_statement_files')->where('statement_id', $decompte['id'])->value('id')),
        'pieceDepense' => L::dans($scene['org'], fn () => DB::table('expense_files')->where('expense_id', $depense)->value('id')),
    ];
}

it('une autre organisation ne voit ni ne touche aucune ressource de Charges : 404 sur chaque route par identifiant', function (): void {
    $a = organisationEmise($this);
    $b = C::autonome();
    C::comme($this, $b['owner']);
    $url = fn (string $chemin): string => C::url($b['org'], $chemin);
    $statement = $a['decompte']['id'];

    $appels = [
        ['GET', "/exercises/{$a['exercice']}", []],
        ['PATCH', "/exercises/{$a['exercice']}", ['lock_version' => 1, 'items' => []]],
        ['POST', "/exercises/{$a['exercice']}/compute", []],
        ['POST', "/exercises/{$a['exercice']}/discard", []],
        ['POST', "/exercises/{$a['exercice']}/issue", []],
        ['GET', "/exercises/{$a['exercice']}/statements.csv", []],
        ['GET', "/statements/{$statement}", []],
        ['GET', "/statements/{$statement}/pdf", []],
        ['POST', "/statements/{$statement}/retry", []],
        ['POST', "/statements/{$statement}/rectify", ['reason' => 'Intrusion']],
        ['POST', "/statements/{$statement}/installment-plan", ['reason' => 'Intrusion', 'basis' => 'agreement']],
        ['PATCH', "/statements/{$statement}/files/{$a['piece']}", ['tenant_visible' => true]],
        ['GET', "/properties/{$a['scene']['property']}/charge-keys", []],
        ['POST', "/properties/{$a['scene']['property']}/charge-keys/{$a['cle']}/versions", ['valid_from' => '2026-01-01', 'shares' => []]],
        ['POST', "/properties/{$a['scene']['property']}/charge-keys/{$a['cle']}/archive", []],
        ['GET', "/expenses/{$a['depense']}/files/{$a['pieceDepense']}", []],
    ];

    foreach ($appels as [$methode, $chemin, $corps]) {
        $reponse = $this->json($methode, $url($chemin), $corps, ['Idempotency-Key' => 'intrusion-'.bin2hex(random_bytes(4))]);

        expect($reponse->status())->toBe(404, "{$methode} {$chemin} -> {$reponse->status()}");
    }

    expect(DB::table('charge_statements')->where('id', $statement)->value('status'))->toBe('issued')
        ->and(DB::table('charge_exercises')->where('id', $a['exercice'])->value('status'))->toBe('issued');
});

it('un gestionnaire ne valide aucune dépense ni n\'exporte aucun CSV de Charges', function (): void {
    $a = organisationEmise($this);
    C::comme($this, C::membre($a['scene']['org'], MemberRole::Manager));

    $this->postJson(C::url($a['scene']['org'], "/expenses/{$a['depense']}/approve"))->assertForbidden();
    $this->get(C::url($a['scene']['org'], '/expenses.csv'))->assertForbidden();
    $this->get(C::url($a['scene']['org'], "/exercises/{$a['exercice']}/statements.csv"))->assertForbidden();
});

it('un comptable n\'émet, ne reprend, ne rectifie, n\'étale ni ne partage aucune pièce', function (): void {
    $a = organisationEmise($this);
    $org = $a['scene']['org'];
    $statement = $a['decompte']['id'];
    C::comme($this, C::membre($org, MemberRole::Accountant));

    $this->postJson(C::url($org, "/exercises/{$a['exercice']}/issue"), [], ['Idempotency-Key' => 'comptable-0001'])->assertForbidden();
    $this->postJson(C::url($org, "/statements/{$statement}/retry"), [], ['Idempotency-Key' => 'comptable-0002'])->assertForbidden();
    $this->postJson(C::url($org, "/statements/{$statement}/rectify"), ['reason' => 'Test'], ['Idempotency-Key' => 'comptable-0003'])->assertForbidden();
    $this->postJson(C::url($org, "/statements/{$statement}/installment-plan"), ['reason' => 'Test', 'basis' => 'agreement'], ['Idempotency-Key' => 'comptable-0004'])->assertForbidden();
    $this->patchJson(C::url($org, "/statements/{$statement}/files/{$a['piece']}"), ['tenant_visible' => true])->assertForbidden();

    expect(L::dans($org, fn () => DB::table('charge_statement_files')->where('id', $a['piece'])->value('tenant_visible')))->toBe(0)
        ->and(L::dans($org, fn () => DB::table('charge_exercises')->whereNotNull('only_lease_id')->count()))->toBe(0);
});
