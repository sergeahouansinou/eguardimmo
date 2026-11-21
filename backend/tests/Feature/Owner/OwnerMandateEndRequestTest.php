<?php

declare(strict_types=1);

use App\Modules\Identity\Enums\OwnerAccessRole;
use App\Modules\Identity\Models\User;
use App\Modules\Mandates\Enums\MandateStatus;
use App\Modules\Mandates\Models\Mandate;
use App\Modules\Mandates\Models\MandateEndRequest;
use App\Modules\Notifications\Enums\NotificationType;
use App\Shared\Audit\AuditLog;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Route;
use Tests\Feature\Leases\LeasesContext as L;
use Tests\Feature\Maintenance\MaintenanceContext as C;
use Tests\Feature\Notifications\NotificationsContext as N;
use Tests\Feature\Owner\OwnerContext as O;
use Tests\Feature\Owner\OwnerReportingContext as X;
use Tests\Feature\Owner\OwnerWriteContext as W;

beforeEach(function (): void {
    ['scene' => $this->scene, 'awa' => $this->awa] = W::agence($this);
    $this->org = $this->scene['org'];
    $this->mandant = $this->scene['mandant'];
    $this->mandat = $this->scene['mandate'];
    $this->demander = function (?User $compte, ?string $mandat = null, array $corps = [], bool $preuve = true) {
        Cache::flush();
        $preuve ? O::preuve($this) : $this->flushSession();

        return O::comme($this, $compte)->postJson('/api/v1/owner/mandates/'.($mandat ?? $this->mandat->id).'/end-request', $corps, O::ORIGINE);
    };
    $this->annuler = function (?User $compte, ?string $mandat = null, bool $preuve = true) {
        Cache::flush();
        $preuve ? O::preuve($this) : $this->flushSession();

        return O::comme($this, $compte)->deleteJson('/api/v1/owner/mandates/'.($mandat ?? $this->mandat->id).'/end-request', [], O::ORIGINE);
    };
    $this->demandes = fn () => MandateEndRequest::query()->withoutGlobalScopes()->get();
    $this->audits = fn (string $action): int => AuditLog::query()->where('action', $action)->count();
});

it('enregistre la demande sans toucher au mandat, journalise et prévient l\'équipe', function (): void {
    $avant = L::dans($this->org, fn () => Mandate::query()->findOrFail($this->mandat->id));

    $reponse = ($this->demander)($this->awa, null, ['reason' => '  Je vends mon bien  '])->assertCreated();

    $demande = ($this->demandes)()->sole();
    $apres = L::dans($this->org, fn () => Mandate::query()->findOrFail($this->mandat->id));

    expect($reponse->json('data'))->toBe([
        'id' => $demande->id,
        'mandate_id' => $this->mandat->id,
        'status' => 'pending',
        'reason' => 'Je vends mon bien',
        'requested_at' => $demande->created_at->toIso8601String(),
        'cancelled_at' => null,
        'decided_at' => null,
        'decision_note' => null,
    ])
        ->and($demande->organization_id)->toBe($this->org->id)->and($demande->mandant_party_id)->toBe($this->mandant->id)
        ->and($demande->requested_by_user_id)->toBe($this->awa->id)
        ->and($apres->status)->toBe($avant->status)->and($apres->lock_version)->toBe($avant->lock_version)
        ->and($apres->ends_on->toDateString())->toBe($avant->ends_on->toDateString())->and($apres->notice_given_on)->toBeNull()
        ->and(($this->audits)('mandates.end_request.created'))->toBe(1);

    $audit = AuditLog::query()->where('action', 'mandates.end_request.created')->sole();
    expect($audit->actor_user_id)->toBe($this->awa->id)->and(json_encode($audit->metadata))->not->toContain('vends');

    $n = N::premiere(L::titulaire($this->org), NotificationType::MandatesEndRequested);
    expect($n->link)->toBe("/mandats/{$this->mandat->id}")->and($n->dedup_key)->toBe("mandate-end:{$demande->id}:requested")
        ->and($n->title.' '.$n->body)->not->toContain('vends')->not->toContain($this->mandant->display_name);
});

it('est rejouable : la demande vivante est renvoyée en 200, sans doublon, second audit ni seconde notification', function (): void {
    $premiere = ($this->demander)($this->awa)->assertCreated()->json('data.id');

    ($this->demander)($this->awa, null, ['reason' => 'autre motif'])->assertOk()->assertJsonPath('data.id', $premiere)->assertJsonPath('data.reason', null);

    expect(($this->demandes)())->toHaveCount(1)->and(($this->audits)('mandates.end_request.created'))->toBe(1)
        ->and(N::nombre(L::titulaire($this->org), NotificationType::MandatesEndRequested))->toBe(1);
});

it('un second compte du mandant retrouve la même demande et peut l\'annuler', function (): void {
    $rep = X::rattacher($this->org, $this->mandant, 'rep@exemple.fr', OwnerAccessRole::Representative);
    activerDeuxFacteurs($rep);
    $id = ($this->demander)($this->awa)->assertCreated()->json('data.id');

    ($this->demander)($rep)->assertOk()->assertJsonPath('data.id', $id);
    ($this->annuler)($rep)->assertOk()->assertJsonPath('data.status', 'cancelled');

    expect(($this->demandes)()->sole()->status->value)->toBe('cancelled');
});

it('annule la demande : statut, date, audit, mandat inchangé, puis une nouvelle demande est possible', function (): void {
    $id = ($this->demander)($this->awa)->assertCreated()->json('data.id');

    $reponse = ($this->annuler)($this->awa)->assertOk();

    expect($reponse->json('data.id'))->toBe($id)->and($reponse->json('data.status'))->toBe('cancelled')->and($reponse->json('data.cancelled_at'))->not->toBeNull()
        ->and(($this->audits)('mandates.end_request.cancelled'))->toBe(1);
    O::comme($this, $this->awa)->getJson('/api/v1/owner/mandates/'.$this->mandat->id)->assertOk()->assertJsonPath('data.end_request', null);

    $seconde = ($this->demander)($this->awa)->assertCreated()->json('data.id');

    expect($seconde)->not->toBe($id)->and(($this->demandes)())->toHaveCount(2)->and(($this->audits)('mandates.end_request.created'))->toBe(2);
});

it('404 mandate_end_request_not_found quand aucune demande ne vit, avant comme après annulation', function (): void {
    ($this->annuler)($this->awa)->assertNotFound()->assertJsonPath('code', 'mandate_end_request_not_found');

    ($this->demander)($this->awa)->assertCreated();
    ($this->annuler)($this->awa)->assertOk();

    ($this->annuler)($this->awa)->assertNotFound()->assertJsonPath('code', 'mandate_end_request_not_found');
    expect(($this->audits)('mandates.end_request.cancelled'))->toBe(1);
});

it('expose la demande vivante dans le mandat du propriétaire et dans la liste, puis la retire à l\'annulation', function (): void {
    $id = ($this->demander)($this->awa, null, ['reason' => 'Départ à l\'étranger'])->assertCreated()->json('data.id');

    $fiche = O::comme($this, $this->awa)->getJson('/api/v1/owner/mandates/'.$this->mandat->id)->assertOk();
    $liste = O::comme($this, $this->awa)->getJson('/api/v1/owner/mandates')->assertOk();

    expect($fiche->json('data.end_request.id'))->toBe($id)->and($fiche->json('data.end_request.status'))->toBe('pending')
        ->and($fiche->json('data.end_request.reason'))->toBe('Départ à l\'étranger')
        ->and($liste->json('data.0.end_request.id'))->toBe($id);

    ($this->annuler)($this->awa)->assertOk();

    O::comme($this, $this->awa)->getJson('/api/v1/owner/mandates')->assertOk()->assertJsonPath('data.0.end_request', null);
});

it('l\'agence lit la demande vivante de son mandat (null sans demande), 404 pour un mandat d\'une autre agence', function (): void {
    $titulaire = L::titulaire($this->org);
    O::comme($this, $titulaire)->getJson(C::url($this->org, "/mandates/{$this->mandat->id}/end-request"))->assertOk()->assertExactJson(['data' => null]);

    $id = ($this->demander)($this->awa, null, ['reason' => 'Départ'])->assertCreated()->json('data.id');

    O::comme($this, $titulaire)->getJson(C::url($this->org, "/mandates/{$this->mandat->id}/end-request"))->assertOk()
        ->assertJsonPath('data.id', $id)->assertJsonPath('data.reason', 'Départ');

    $autre = L::organisation();
    O::comme($this, L::titulaire($autre))->getJson(C::url($autre, "/mandates/{$this->mandat->id}/end-request"))->assertNotFound();
    O::comme($this, null)->getJson(C::url($this->org, "/mandates/{$this->mandat->id}/end-request"))->assertUnauthorized();
});

it('valide le motif : facultatif, 1000 caractères au plus, ignoré s\'il est vide', function (): void {
    ($this->demander)($this->awa, null, ['reason' => str_repeat('a', 1001)])->assertUnprocessable();
    expect(($this->demandes)())->toHaveCount(0);

    ($this->demander)($this->awa, null, ['reason' => '   '])->assertCreated()->assertJsonPath('data.reason', null);
});

it('ignore organization_id, mandant, statut et auteur envoyés par le client', function (): void {
    $autre = O::mandant($this->org, 'bob@exemple.fr');

    ($this->demander)($this->awa, null, [
        'organization_id' => L::organisation()->id, 'mandate_id' => fake()->uuid(), 'mandant_party_id' => $autre->id,
        'status' => 'cancelled', 'requested_by_user_id' => fake()->uuid(), 'access_id' => fake()->uuid(),
    ])->assertCreated()->assertJsonPath('data.status', 'pending')->assertJsonPath('data.mandate_id', $this->mandat->id);

    $demande = ($this->demandes)()->sole();

    expect($demande->organization_id)->toBe($this->org->id)->and($demande->mandant_party_id)->toBe($this->mandant->id)
        ->and($demande->requested_by_user_id)->toBe($this->awa->id)->and($demande->status->value)->toBe('pending');
});

it('401 sans session, 403 sans profil propriétaire, rien d\'écrit', function (): void {
    ($this->demander)(null)->assertUnauthorized();
    ($this->annuler)(null)->assertUnauthorized();

    foreach ([User::factory()->create(), L::titulaire($this->org)] as $compte) {
        activerDeuxFacteurs($compte);
        ($this->demander)($compte)->assertForbidden()->assertJsonPath('code', 'space_forbidden');
        ($this->annuler)($compte)->assertForbidden()->assertJsonPath('code', 'space_forbidden');
    }

    expect(($this->demandes)())->toHaveCount(0);
});

it('exige la 2FA confirmée et une preuve récente pour demander comme pour annuler', function (): void {
    $sans = X::rattacher($this->org, $this->mandant, 'sans@exemple.fr');

    ($this->demander)($sans)->assertForbidden()->assertJsonPath('code', 'two_factor_required');
    ($this->demander)($this->awa, null, [], false)->assertForbidden()->assertJsonPath('code', 'reauthentication_required');
    expect(($this->demandes)())->toHaveCount(0);

    ($this->demander)($this->awa)->assertCreated();
    ($this->annuler)($this->awa, null, false)->assertForbidden()->assertJsonPath('code', 'reauthentication_required');
    ($this->annuler)($sans)->assertForbidden()->assertJsonPath('code', 'two_factor_required');

    expect(($this->demandes)()->sole()->status->value)->toBe('pending');
});

it('403 pour un co-indivisaire et pendant la grâce, sans rien écrire', function (): void {
    $co = User::factory()->create(['email' => 'co@exemple.fr']);
    O::acces($this->org, $this->mandant, $co, OwnerAccessRole::CoOwner);
    activerDeuxFacteurs($co);

    ($this->demander)($co)->assertForbidden()->assertJsonPath('code', 'owner_role_forbidden');
    ($this->annuler)($co)->assertForbidden()->assertJsonPath('code', 'owner_role_forbidden');

    ($this->demander)($this->awa)->assertCreated();
    L::dans($this->org, fn () => Mandate::query()->update(['status' => 'terminated', 'ends_on' => now()->subMonth()->toDateString()]));

    ($this->demander)($this->awa)->assertForbidden()->assertJsonPath('code', 'owner_access_read_only');
    ($this->annuler)($this->awa)->assertForbidden()->assertJsonPath('code', 'owner_access_read_only');

    expect(($this->demandes)()->sole()->status->value)->toBe('pending');
});

it('409 mandate_not_active pour un mandat suspendu et rien d\'écrit', function (): void {
    L::dans($this->org, fn () => Mandate::query()->update(['status' => 'suspended']));

    ($this->demander)($this->awa)->assertConflict()->assertJsonPath('code', 'mandate_not_active');

    expect(($this->demandes)())->toHaveCount(0)->and(N::nombre(L::titulaire($this->org), NotificationType::MandatesEndRequested))->toBe(0);
});

it('404 owner_mandate_not_found : mandat d\'un autre mandant, d\'une autre organisation, brouillon, inconnu ou mal formé', function (): void {
    $autreMandant = O::mandant($this->org, 'bob@exemple.fr');
    $mandatBob = O::mandat($this->org, $autreMandant);
    $ailleurs = L::organisation();
    $ailleursMandant = O::mandant($ailleurs, 'awa@exemple.fr');
    $mandatAilleurs = O::mandat($ailleurs, $ailleursMandant);
    $brouillon = O::mandat($this->org, $this->mandant, MandateStatus::Draft);

    foreach ([$mandatBob->id, $mandatAilleurs->id, $brouillon->id, fake()->uuid()] as $cible) {
        ($this->demander)($this->awa, $cible)->assertNotFound()->assertJsonPath('code', 'owner_mandate_not_found');
        ($this->annuler)($this->awa, $cible)->assertNotFound()->assertJsonPath('code', 'owner_mandate_not_found');
    }

    ($this->demander)($this->awa, 'pas-un-uuid')->assertNotFound();

    expect(($this->demandes)())->toHaveCount(0);
});

it('un homonyme rattaché à une autre organisation ne demande pas la fin du mandat de cette agence', function (): void {
    $ailleurs = L::organisation();
    $ailleursMandant = O::mandant($ailleurs, 'awa@exemple.fr');
    O::mandat($ailleurs, $ailleursMandant);
    $clone = X::rattacher($ailleurs, $ailleursMandant, 'clone@exemple.fr');
    activerDeuxFacteurs($clone);

    ($this->demander)($clone)->assertNotFound()->assertJsonPath('code', 'owner_mandate_not_found');

    expect(($this->demandes)())->toHaveCount(0);
});

it('la clé unique tient une seule demande vivante par mandat', function (): void {
    ($this->demander)($this->awa)->assertCreated();

    expect(fn () => L::dans($this->org, fn () => (new MandateEndRequest)->forceFill([
        'organization_id' => $this->org->id, 'mandate_id' => $this->mandat->id, 'mandant_party_id' => $this->mandant->id,
        'access_id' => fake()->uuid(), 'requested_by_user_id' => $this->awa->id, 'status' => 'pending',
    ])->save()))->toThrow(QueryException::class);
});

it('coupe les écritures au-delà de 10 requêtes par minute', function (): void {
    Cache::flush();
    O::preuve($this);
    $statuts = [];

    foreach (range(1, 12) as $i) {
        $statuts[] = O::comme($this, $this->awa)->postJson('/api/v1/owner/mandates/'.$this->mandat->id.'/end-request', [], O::ORIGINE)->status();
    }

    expect($statuts[10])->toBe(429);
});

it('protège les routes : middlewares, noms, méthodes et limite dédiée', function (): void {
    foreach (['mandates.owner.end-request.store' => 'POST', 'mandates.owner.end-request.destroy' => 'DELETE'] as $nom => $methode) {
        $route = Route::getRoutes()->getByName($nom);

        expect($route->gatherMiddleware())->toContain('auth:sanctum', 'no-operator-token', 'space:owner', 'verified', 'throttle:10,1,owner-mandate-end', 'two-factor', 'reauthenticated:two-factor')
            ->and($route->methods())->toContain($methode);
    }
});
