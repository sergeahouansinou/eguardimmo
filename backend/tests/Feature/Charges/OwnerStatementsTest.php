<?php

declare(strict_types=1);

use App\Modules\Identity\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\Feature\Charges\ChargesContext as C;
use Tests\Feature\Charges\ExercisesContext as E;
use Tests\Feature\Owner\OwnerContext as O;
use Tests\Feature\Tenant\TenantContext as T;
use Tests\Feature\Tenant\TenantRentContext as R;

const URL_MANDANT = '/api/v1/owner/charge-statements';

beforeEach(function (): void {
    C::preparer($this);
    $this->scene = C::agence();
    $scene = $this->scene;
    C::activerFonds($scene['org']);
    E::appeler($this, $scene['org'], $scene['lease'], 3);
    C::comme($this, $scene['owner']);
    $exercice = E::exerciceAvecPoste($this, $scene, E::depense($this, $scene), 80000, ['unit_id' => $scene['unit']->id]);
    E::calculer($this, $scene, $exercice)->assertOk();
    $this->decompte = E::emettre($this, $scene, $exercice)->assertOk()->json('data.statements.0');
    $this->moi = User::factory()->create();
    O::acces($scene['org'], $scene['mandant'], $this->moi);
});

it('montre au mandant les décomptes de son lot : nom du locataire seulement, jamais ses coordonnées ni ses identifiants', function (): void {
    O::comme($this, $this->moi)->getJson(URL_MANDANT)->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $this->decompte['id'])
        ->assertJsonPath('data.0.agency_name', $this->scene['org']->name)->assertJsonMissingPath('data.0.lines');

    $detail = O::comme($this, $this->moi)->getJson(URL_MANDANT."/{$this->decompte['id']}")->assertOk()->assertJsonCount(1, 'data.lines');
    $brut = (string) $detail->getContent();

    expect($detail->json('data.tenant_names'))->toHaveCount(1)->and($detail->headers->get('Cache-Control'))->toContain('no-store')->toContain('private');
    foreach (['mandant_party_id', 'mandate_id', 'failure_reason', 'snapshot', 'fingerprint', 'lease_id', 'party_id', 'email', 'phone', $this->scene['tenantParty']->id, $this->scene['lease']->id] as $interdit) {
        expect($brut)->not->toContain($interdit);
    }
});

it('répond 404 sur le décompte d\'un autre mandant de la même agence ou d\'une autre agence, sans le distinguer d\'un inconnu', function (): void {
    $autre = O::proprietaire($this->scene['org'], 'autre.mandant@exemple.fr');
    $ailleurs = O::proprietaire(T::organisation('Immo Loire'), 'loire@exemple.fr');
    $inconnu = (string) Str::uuid7();

    foreach ([$autre['user'], $ailleurs['user']] as $intrus) {
        O::comme($this, $intrus)->getJson(URL_MANDANT)->assertOk()->assertJsonCount(0, 'data');
        O::comme($this, $intrus)->getJson(URL_MANDANT."/{$this->decompte['id']}")->assertNotFound()->assertJsonPath('code', 'charge_statement_not_found');
        O::comme($this, $intrus)->getJson(URL_MANDANT."/{$inconnu}")->assertNotFound()->assertJsonPath('code', 'charge_statement_not_found');
    }
});

it('filtre par agence sans élargir le périmètre', function (): void {
    O::comme($this, $this->moi)->getJson(URL_MANDANT.'?agency='.$this->scene['org']->id)->assertOk()->assertJsonCount(1, 'data');
    O::comme($this, $this->moi)->getJson(URL_MANDANT.'?agency='.Str::uuid7())->assertNotFound();
    O::comme($this, $this->moi)->getJson(URL_MANDANT.'?agency=pas-un-uuid')->assertNotFound();
});

it('montre aussi un décompte remplacé par un rectificatif', function (): void {
    DB::table('charge_statements')->where('id', $this->decompte['id'])->update(['status' => 'superseded']);
    O::comme($this, $this->moi)->getJson(URL_MANDANT)->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.status', 'superseded');
});

it('exige une session, un profil propriétaire, un compte vérifié et refuse le jeton opérateur ; le locataire n\'entre pas', function (): void {
    $chemins = ['', "/{$this->decompte['id']}"];
    auth()->forgetGuards();

    foreach ($chemins as $chemin) {
        $this->getJson(URL_MANDANT.$chemin)->assertUnauthorized();
    }

    $locataire = User::factory()->create();
    R::rattacher($this->scene['org'], $this->scene['tenantParty'], $locataire);

    foreach ($chemins as $chemin) {
        O::comme($this, User::factory()->create())->getJson(URL_MANDANT.$chemin)->assertForbidden();
        O::comme($this, $locataire)->getJson(URL_MANDANT.$chemin)->assertForbidden();
        O::comme($this, User::factory()->unverified()->create())->getJson(URL_MANDANT.$chemin)->assertForbidden()->assertJsonPath('code', 'email_unverified');
    }

    $this->moi->operator()->create(['granted_at' => now()])->roles()->create(['role' => 'admin', 'granted_at' => now()]);
    activerDeuxFacteurs($this->moi);
    O::comme($this, null);
    $jeton = $this->moi->createToken('console', ['operator'])->plainTextToken;

    foreach ($chemins as $chemin) {
        $this->withToken($jeton)->getJson(URL_MANDANT.$chemin)->assertForbidden()->assertJsonPath('code', 'operator_token_forbidden');
    }
});
