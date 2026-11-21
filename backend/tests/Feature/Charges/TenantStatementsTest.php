<?php

declare(strict_types=1);

use App\Modules\Identity\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\Feature\Charges\ChargesContext as C;
use Tests\Feature\Charges\ExercisesContext as E;
use Tests\Feature\Leases\LeasesContext as L;
use Tests\Feature\Tenant\TenantContext as T;
use Tests\Feature\Tenant\TenantRentContext as R;

const URL_LOCATAIRE = '/api/v1/tenant/charge-statements';

beforeEach(function (): void {
    C::preparer($this);
    ['scene' => $scene, 'exercice' => $exercice] = E::calcule($this, 8000);
    $this->scene = $scene;
    $this->decompte = E::emettre($this, $scene, $exercice)->assertOk()->json('data.statements.0');
    $this->moi = User::factory()->create();
    R::rattacher($scene['org'], $scene['tenantParty'], $this->moi);
});

it('liste et détaille le décompte du bail du locataire sans rien révéler de la gestion interne', function (): void {
    T::comme($this, $this->moi)->getJson(URL_LOCATAIRE)->assertOk()->assertHeader('Cache-Control')
        ->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $this->decompte['id'])->assertJsonPath('data.0.number', 'DC-2026-0001')
        ->assertJsonPath('data.0.balance.amount', 3000)->assertJsonPath('data.0.settlement', 'next_installments')->assertJsonMissingPath('data.0.lines');

    $detail = T::comme($this, $this->moi)->getJson(URL_LOCATAIRE."/{$this->decompte['id']}")->assertOk();
    $detail->assertJsonCount(1, 'data.lines')->assertJsonPath('data.lines.0.share.amount', 8000);
    expect($detail->headers->get('Cache-Control'))->toContain('no-store')->toContain('private');

    foreach (['mandant_party_id', 'failure_reason', 'snapshot', 'fingerprint', 'mandate_id', 'organization_id', 'exercise_id'] as $cle) {
        expect($detail->json('data'))->not->toHaveKey($cle);
    }
});

it('filtre par bail et pagine avec un curseur', function (): void {
    T::comme($this, $this->moi)->getJson(URL_LOCATAIRE.'?lease='.$this->scene['lease']->id)->assertOk()->assertJsonCount(1, 'data');
    T::comme($this, $this->moi)->getJson(URL_LOCATAIRE.'?lease='.(string) Str::uuid7())->assertOk()->assertJsonCount(0, 'data');
    T::comme($this, $this->moi)->getJson(URL_LOCATAIRE.'?per_page=1')->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('next_cursor', null);
    T::comme($this, $this->moi)->getJson(URL_LOCATAIRE.'?lease=pas-un-uuid')->assertStatus(422);
});

it('télécharge le PDF du décompte et journalise l\'accès', function (): void {
    T::comme($this, $this->moi)->get(URL_LOCATAIRE."/{$this->decompte['id']}/pdf")->assertOk()->assertHeader('Content-Type', 'application/pdf');
    expect(DB::table('audit_logs')->where('action', 'charges.statement.downloaded')->count())->toBe(1);
});

it('laisse un colocataire du même bail lire le décompte', function (): void {
    $co = User::factory()->create();
    $partie = T::colocataire($this->scene['org'], $this->scene['lease']);
    R::rattacher($this->scene['org'], $partie, $co);

    T::comme($this, $co)->getJson(URL_LOCATAIRE."/{$this->decompte['id']}")->assertOk()->assertJsonPath('data.id', $this->decompte['id']);
});

it('répond 404 sur le décompte d\'un autre locataire, de la même organisation ou d\'une autre, sans le distinguer d\'un inconnu', function (): void {
    $memeOrg = T::locataire($this->scene['org']);
    $autreOrg = T::locataire(T::organisation('Immo Loire'));
    $inconnu = (string) Str::uuid7();

    foreach ([$memeOrg['user'], $autreOrg['user']] as $intrus) {
        T::comme($this, $intrus)->getJson(URL_LOCATAIRE)->assertOk()->assertJsonCount(0, 'data');

        foreach (["/{$this->decompte['id']}", "/{$this->decompte['id']}/pdf", "/{$this->decompte['id']}/files/{$inconnu}", "/{$inconnu}"] as $chemin) {
            T::comme($this, $intrus)->getJson(URL_LOCATAIRE.$chemin)->assertNotFound()->assertJsonPath('code', 'charge_statement_not_found');
        }
    }

    T::comme($this, $this->moi)->getJson(URL_LOCATAIRE."/{$inconnu}")->assertNotFound()->assertJsonPath('code', 'charge_statement_not_found');
});

it('ne montre jamais un décompte calculé, non émis', function (): void {
    ['scene' => $scene, 'exercice' => $exercice] = E::calcule($this, 4000);
    $calcule = collect(E::decomptes($scene['org'], $exercice))->first();
    $moi = User::factory()->create();
    R::rattacher($scene['org'], $scene['tenantParty'], $moi);

    T::comme($this, $moi)->getJson(URL_LOCATAIRE)->assertOk()->assertJsonCount(0, 'data');
    T::comme($this, $moi)->getJson(URL_LOCATAIRE.'/'.$calcule['id'])->assertNotFound();
});

it('ne publie une pièce que partagée et dans sa période de mise à disposition', function (): void {
    C::comme($this, $this->scene['owner']);
    $detail = $this->getJson(C::url($this->scene['org'], "/statements/{$this->decompte['id']}"))->assertOk();
    $piece = $detail->json('data.files.0');

    T::comme($this, $this->moi)->getJson(URL_LOCATAIRE."/{$this->decompte['id']}")->assertOk()->assertJsonCount(0, 'data.files');
    T::comme($this, $this->moi)->getJson(URL_LOCATAIRE."/{$this->decompte['id']}/files/{$piece['id']}")->assertNotFound()->assertJsonPath('code', 'charges_file_not_found');

    C::comme($this, $this->scene['owner'])->patchJson(C::url($this->scene['org'], "/statements/{$this->decompte['id']}/files/{$piece['id']}"), ['tenant_visible' => true])->assertOk();
    T::comme($this, $this->moi)->getJson(URL_LOCATAIRE."/{$this->decompte['id']}")->assertOk()->assertJsonCount(1, 'data.files')->assertJsonPath('data.files.0.id', $piece['id']);
    T::comme($this, $this->moi)->get(URL_LOCATAIRE."/{$this->decompte['id']}/files/{$piece['id']}")->assertOk();

    $this->travelTo(now()->addMonths(7));
    T::comme($this, $this->moi)->getJson(URL_LOCATAIRE."/{$this->decompte['id']}")->assertOk()->assertJsonCount(0, 'data.files');
    T::comme($this, $this->moi)->getJson(URL_LOCATAIRE."/{$this->decompte['id']}/files/{$piece['id']}")->assertNotFound();
});

it('exige une session, un profil locataire, un compte vérifié et refuse le jeton opérateur', function (): void {
    $chemins = ['', "/{$this->decompte['id']}", "/{$this->decompte['id']}/pdf", "/{$this->decompte['id']}/files/".Str::uuid7()];
    auth()->forgetGuards();

    foreach ($chemins as $chemin) {
        $this->getJson(URL_LOCATAIRE.$chemin)->assertUnauthorized();
    }

    foreach ($chemins as $chemin) {
        T::comme($this, User::factory()->create())->getJson(URL_LOCATAIRE.$chemin)->assertForbidden()->assertJsonPath('code', 'space_forbidden');
        T::comme($this, User::factory()->unverified()->create())->getJson(URL_LOCATAIRE.$chemin)->assertForbidden()->assertJsonPath('code', 'email_unverified');
    }

    $this->moi->operator()->create(['granted_at' => now()])->roles()->create(['role' => 'admin', 'granted_at' => now()]);
    activerDeuxFacteurs($this->moi);
    T::comme($this, null);
    $jeton = $this->moi->createToken('console', ['operator'])->plainTextToken;

    foreach ($chemins as $chemin) {
        $this->withToken($jeton)->getJson(URL_LOCATAIRE.$chemin)->assertForbidden()->assertJsonPath('code', 'operator_token_forbidden');
    }
});

it('refuse à un locataire les routes de l\'agence', function (): void {
    T::comme($this, $this->moi)->getJson(C::url($this->scene['org'], "/statements/{$this->decompte['id']}"))->assertNotFound();
    expect(L::dans($this->scene['org'], fn () => DB::table('charge_statements')->count()))->toBe(1);
});
