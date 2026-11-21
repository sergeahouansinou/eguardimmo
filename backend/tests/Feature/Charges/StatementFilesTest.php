<?php

declare(strict_types=1);

use App\Modules\Identity\Models\User;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Tests\Feature\Charges\ChargesContext as C;
use Tests\Feature\Charges\ExercisesContext as E;
use Tests\Feature\Leases\LeasesContext as L;
use Tests\Feature\Tenant\TenantContext as T;
use Tests\Feature\Tenant\TenantRentContext as R;

beforeEach(function (): void {
    C::preparer($this);
});

it('ne rattache à un décompte que les pièces des postes où il a une ligne, sous un libellé neutre', function (): void {
    $this->travelTo('2026-11-16');
    $scene = E::sceneVide();
    $autreLot = E::lot($scene['org'], $scene['property']);
    $bailA = E::bailSurLot($scene['org'], $scene['unit'], ['starts_on' => '2026-01-01']);
    $bailB = E::bailSurLot($scene['org'], $autreLot, ['starts_on' => '2026-01-01']);
    C::comme($this, $scene['owner']);
    $depenseA = E::depense($this, $scene, 80000, ['unit_id' => $scene['unit']->id, 'payee_label' => 'Jean Dupont', 'reference' => 'FA-1']);
    $depenseB = E::depense($this, $scene, 80000, ['unit_id' => $autreLot->id, 'payee_label' => 'Marie Curie', 'reference' => 'FB-1']);
    $exercice = E::exercice($this, $scene, ['items' => [
        E::poste('Ascenseur A', 'elevators', ['kind' => 'expense', 'id' => $depenseA, 'amount' => 80000], ['unit_id' => $scene['unit']->id]),
        E::poste('Ascenseur B', 'elevators', ['kind' => 'expense', 'id' => $depenseB, 'amount' => 80000], ['unit_id' => $autreLot->id]),
    ]])->assertCreated()->json('data.id');
    E::calculer($this, $scene, $exercice)->assertOk();
    E::emettre($this, $scene, $exercice)->assertOk();

    $pieces = L::dans($scene['org'], fn (): array => DB::table('charge_statement_files as f')->join('charge_statements as s', 's.id', '=', 'f.statement_id')
        ->orderBy('s.lease_id')->get(['s.lease_id as bail', 'f.label as libelle', 'f.stored_file_id as fichier'])->all());
    $parBail = collect($pieces)->groupBy('bail');

    expect($pieces)->toHaveCount(2)->and($parBail)->toHaveCount(2)
        ->and($parBail->get($bailA->id))->toHaveCount(1)->and($parBail->get($bailB->id))->toHaveCount(1)
        ->and($parBail->get($bailA->id)[0]->libelle)->toBe('elevators — FA-1')->and($parBail->get($bailB->id)[0]->libelle)->toBe('elevators — FB-1')
        ->and($parBail->get($bailA->id)[0]->fichier)->not->toBe($parBail->get($bailB->id)[0]->fichier);

    foreach ($pieces as $piece) {
        expect($piece->libelle)->not->toContain('Dupont')->and($piece->libelle)->not->toContain('Curie');
    }
});

it('refuse en base une pièce visible sans date limite', function (): void {
    ['scene' => $scene, 'exercice' => $exercice] = E::calcule($this, 8000);
    E::emettre($this, $scene, $exercice)->assertOk();
    $piece = L::dans($scene['org'], fn () => DB::table('charge_statement_files')->first());

    expect(fn () => L::dans($scene['org'], fn () => DB::table('charge_statement_files')->where('id', $piece->id)->update(['tenant_visible' => true, 'visible_until' => null])))->toThrow(QueryException::class);
});

it('une pièce visible sans date limite n\'est jamais servie au locataire', function (): void {
    ['scene' => $scene, 'exercice' => $exercice] = E::calcule($this, 8000);
    $decompte = E::emettre($this, $scene, $exercice)->assertOk()->json('data.statements.0');
    $moi = User::factory()->create();
    R::rattacher($scene['org'], $scene['tenantParty'], $moi);
    $piece = L::dans($scene['org'], function () {
        foreach (DB::select("select name from sqlite_master where type = 'trigger' and tbl_name = 'charge_statement_files'") as $declencheur) {
            DB::unprepared("drop trigger {$declencheur->name}");
        }

        DB::table('charge_statement_files')->update(['tenant_visible' => true, 'visible_until' => null]);

        return DB::table('charge_statement_files')->first();
    });

    T::comme($this, $moi)->getJson("/api/v1/tenant/charge-statements/{$decompte['id']}")->assertOk()->assertJsonCount(0, 'data.files');
    T::comme($this, $moi)->get("/api/v1/tenant/charge-statements/{$decompte['id']}/files/{$piece->id}")->assertNotFound();
});
