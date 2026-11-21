<?php

declare(strict_types=1);

use App\Modules\Identity\Enums\OwnerAccessRole;
use App\Modules\Identity\Events\AccountDeleted;
use App\Modules\Identity\Models\OwnerInvitation;
use App\Modules\Identity\Models\User;
use App\Modules\Identity\Notifications\OwnerInvitationNotification;
use App\Modules\Organizations\Enums\MemberRole;
use App\Modules\Parties\Models\OwnerAccess;
use App\Shared\Audit\AuditLog;
use Carbon\CarbonImmutable;
use Illuminate\Database\QueryException;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Str;
use Tests\Feature\Leases\LeasesContext as L;
use Tests\Feature\Owner\OwnerContext as O;
use Tests\Feature\Tenant\TenantContext as T;

beforeEach(function (): void {
    Notification::fake();
    L::semer();
    $this->travelTo(CarbonImmutable::parse(O::AUJOURDHUI));
    $this->org = T::organisation();
    $this->titulaire = L::titulaire($this->org);
    O::navigateurAgence($this);
    O::preuve($this);
    $this->p = O::proprietaire($this->org);
    $this->lire = fn (string $chemin = '/agencies') => O::comme($this, $this->p['user'])->getJson('/api/v1/owner'.$chemin);
    $this->accesActuels = fn (): int => L::dans($this->org, fn (): int => OwnerAccess::query()->where('status', 'active')->count());
});

it('exige une session sur chaque route : 401 sans connexion', function (): void {
    $this->getJson('/api/v1/owner/agencies')->assertUnauthorized();
    $this->getJson('/api/v1/owner/links')->assertUnauthorized();
    $this->deleteJson('/api/v1/owner/links/'.$this->p['access']->id)->assertUnauthorized();
    $this->postJson('/api/v1/owner-invitations/preview', [])->assertUnauthorized();
    $this->postJson('/api/v1/owner-invitations/acceptance', [])->assertUnauthorized();
    $this->getJson(O::urlAcces($this->org, $this->p['party']))->assertUnauthorized();
    $this->postJson(O::urlAcces($this->org, $this->p['party']), [])->assertUnauthorized();
    $this->deleteJson(O::urlAcces($this->org, $this->p['party'], '/'.$this->p['access']->id))->assertUnauthorized();
});

it('refuse l\'espace propriétaire sans profil : 403 pour un compte quelconque, un locataire et un membre d\'agence', function (): void {
    $quelconque = User::factory()->create();
    $locataire = T::locataire($this->org)['user'];

    foreach ([$quelconque, $locataire, $this->titulaire] as $compte) {
        O::comme($this, $compte)->getJson('/api/v1/owner/agencies')->assertForbidden()->assertJsonPath('code', 'space_forbidden');
        O::comme($this, $compte)->getJson('/api/v1/owner/links')->assertForbidden()->assertJsonPath('code', 'space_forbidden');
        O::comme($this, $compte)->deleteJson('/api/v1/owner/links/'.$this->p['access']->id)->assertForbidden();
    }
});

it('refuse un compte à l\'adresse non vérifiée et un jeton opérateur', function (): void {
    $this->p['user']->forceFill(['email_verified_at' => null])->save();
    ($this->lire)()->assertForbidden()->assertJsonPath('code', 'email_unverified');

    $operateur = User::factory()->create();
    $operateur->operator()->create(['granted_at' => now()])->roles()->create(['role' => 'admin', 'granted_at' => now()]);
    activerDeuxFacteurs($operateur);
    O::comme($this, null);
    $this->flushHeaders();
    foreach (['/api/v1/owner/agencies', '/api/v1/owner/links'] as $chemin) {
        $this->withToken($operateur->createToken('console', ['operator'])->plainTextToken)->getJson($chemin)->assertForbidden()->assertJsonPath('code', 'operator_token_forbidden');
    }
    $this->withToken($operateur->createToken('console', ['operator'])->plainTextToken)
        ->postJson('/api/v1/owner-invitations/acceptance', ['token' => str_repeat('a', 48), 'code' => '123456', 'consent' => true])
        ->assertForbidden()->assertJsonPath('code', 'operator_token_forbidden');
});

it('réserve l\'invitation aux rôles propriétaire, administrateur et gestionnaire de l\'agence', function (): void {
    $comptable = L::membre($this->org, MemberRole::Accountant);
    $gestionnaire = L::membre($this->org, MemberRole::Manager);
    activerDeuxFacteurs($gestionnaire);
    $corps = ['role' => 'holder', 'identity_verified' => true, 'email' => 'nouveau@exemple.fr'];

    O::comme($this, $comptable)->postJson(O::urlAcces($this->org, $this->p['party']), $corps)->assertForbidden()->assertJsonPath('code', 'role_forbidden');
    O::comme($this, $comptable)->getJson(O::urlAcces($this->org, $this->p['party']))->assertForbidden();
    O::comme($this, $comptable)->deleteJson(O::urlAcces($this->org, $this->p['party'], '/'.$this->p['access']->id))->assertForbidden();
    O::comme($this, $this->p['user'])->postJson(O::urlAcces($this->org, $this->p['party']), $corps)->assertNotFound()->assertJsonPath('code', 'organization_not_found');
    O::comme($this, $gestionnaire)->postJson(O::urlAcces($this->org, $this->p['party']), $corps)->assertCreated();
});

it('cloisonne l\'agence : le mandant et l\'accès d\'une autre organisation sont introuvables', function (): void {
    $autreOrg = T::organisation('Immo Loire');
    $autreTitulaire = L::titulaire($autreOrg);
    $autre = O::proprietaire($autreOrg, 'bob@exemple.fr');
    $corps = ['role' => 'holder', 'identity_verified' => true, 'email' => 'x@exemple.fr'];

    O::comme($this, $autreTitulaire)->postJson(O::urlAcces($autreOrg, $this->p['party']), $corps)->assertNotFound()->assertJsonPath('code', 'party_not_found');
    O::comme($this, $autreTitulaire)->getJson(O::urlAcces($autreOrg, $this->p['party']))->assertNotFound();
    O::comme($this, $autreTitulaire)->deleteJson(O::urlAcces($autreOrg, $this->p['party'], '/'.$this->p['access']->id))->assertNotFound();
    O::comme($this, $this->titulaire)->postJson("/api/v1/org/{$autreOrg->id}/parties/{$this->p['party']->id}/owner-access", $corps)->assertNotFound();

    O::comme($this, $this->titulaire)->deleteJson(O::urlAcces($this->org, $this->p['party'], '/'.$autre['access']->id))->assertNotFound()->assertJsonPath('code', 'owner_access_not_found');
    O::comme($this, $this->titulaire)->deleteJson(O::urlAcces($this->org, $this->p['party'], '/'.Str::uuid7()))->assertNotFound()->assertJsonPath('code', 'owner_access_not_found');
    O::comme($this, $this->titulaire)->deleteJson(O::urlAcces($this->org, $this->p['party'], '/pas-un-uuid'))->assertNotFound();
    expect(L::dans($autreOrg, fn (): int => OwnerAccess::query()->where('status', 'active')->count()))->toBe(1);
    expect(($this->accesActuels)())->toBe(1);
});

it('refuse à un mandant l\'accès de l\'autre mandant de la même agence', function (): void {
    $autreMandant = O::proprietaire($this->org, 'bob@exemple.fr');

    O::comme($this, $this->titulaire)->deleteJson(O::urlAcces($this->org, $this->p['party'], '/'.$autreMandant['access']->id))->assertNotFound();
    O::comme($this, $this->p['user'])->deleteJson('/api/v1/owner/links/'.$autreMandant['access']->id)->assertNotFound()->assertJsonPath('code', 'owner_access_not_found');
    O::comme($this, $this->p['user'])->deleteJson('/api/v1/owner/links/'.Str::uuid7())->assertNotFound();
    expect(($this->accesActuels)())->toBe(2);
    ($this->lire)()->assertJsonCount(1, 'data')->assertJsonPath('data.0.mandant.name', $this->p['party']->display_name);
});

it('révoque l\'accès par l\'agence avec effet immédiat sur le profil et les lectures', function (): void {
    ($this->lire)()->assertOk();

    O::comme($this, $this->titulaire)->deleteJson(O::urlAcces($this->org, $this->p['party'], '/'.$this->p['access']->id))->assertNoContent();

    ($this->lire)()->assertForbidden()->assertJsonPath('code', 'space_forbidden');
    ($this->lire)('/links')->assertForbidden();
    O::comme($this, $this->p['user'])->getJson('/api/v1/me/profiles')->assertOk()->assertJsonCount(0, 'data');
    O::comme($this, $this->titulaire)->getJson(O::urlAcces($this->org, $this->p['party']))->assertJsonCount(0, 'data.accesses');
    $acces = L::dans($this->org, fn (): OwnerAccess => OwnerAccess::query()->findOrFail($this->p['access']->id));
    expect($acces->status->value)->toBe('revoked')->and($acces->revoked_by->value)->toBe('organization')->and($acces->revoked_at)->not->toBeNull();
    expect(AuditLog::query()->where('action', 'parties.owner_access.unlinked')->count())->toBe(1);
    O::comme($this, $this->titulaire)->deleteJson(O::urlAcces($this->org, $this->p['party'], '/'.$this->p['access']->id))->assertNotFound();
});

it('révoque une invitation en attente par la même route', function (): void {
    $reponse = O::comme($this, $this->titulaire)->postJson(O::urlAcces($this->org, $this->p['party']), ['role' => 'holder', 'identity_verified' => true, 'email' => 'nouveau@exemple.fr'])->assertCreated();

    O::comme($this, $this->titulaire)->deleteJson(O::urlAcces($this->org, $this->p['party'], '/'.$reponse->json('data.invitation.id')))->assertNoContent();
    O::comme($this, $this->titulaire)->getJson(O::urlAcces($this->org, $this->p['party']))->assertJsonCount(0, 'data.invitations');
    expect(AuditLog::query()->pluck('action')->all())->toContain('identity.owner_invitation.revoked');
});

it('laisse le compte révoquer son propre accès, et lui seul, avec effet immédiat', function (): void {
    $lien = $this->p['access']->id;

    O::comme($this, $this->p['user'])->deleteJson("/api/v1/owner/links/{$lien}")->assertNoContent();

    ($this->lire)()->assertForbidden();
    $acces = L::dans($this->org, fn (): OwnerAccess => OwnerAccess::query()->findOrFail($lien));
    expect($acces->status->value)->toBe('revoked')->and($acces->revoked_by->value)->toBe('account');
    O::comme($this, $this->p['user'])->deleteJson("/api/v1/owner/links/{$lien}")->assertForbidden();
    expect(L::dans($this->org, fn (): int => OwnerAccess::query()->count()))->toBe(1);
});

it('laisse un co-indivisaire révoquer son propre lien mais pas celui du titulaire', function (): void {
    $co = User::factory()->create(['email' => 'co@exemple.fr']);
    $acces = O::acces($this->org, $this->p['party'], $co, OwnerAccessRole::CoOwner);

    O::comme($this, $co)->deleteJson('/api/v1/owner/links/'.$this->p['access']->id)->assertNotFound();
    O::comme($this, $co)->deleteJson("/api/v1/owner/links/{$acces->id}")->assertNoContent();
    ($this->lire)()->assertOk();
});

it('révoque les accès et l\'invitation en attente quand le mandant est anonymisé', function (): void {
    O::comme($this, $this->titulaire)->postJson(O::urlAcces($this->org, $this->p['party']), ['role' => 'holder', 'identity_verified' => true, 'email' => 'nouveau@exemple.fr'])->assertCreated();

    O::comme($this, $this->titulaire)->postJson("/api/v1/org/{$this->org->id}/parties/{$this->p['party']->id}/anonymization")->assertSuccessful();

    ($this->lire)()->assertForbidden();
    expect(L::dans($this->org, fn (): string => OwnerAccess::query()->firstOrFail()->revoked_by->value))->toBe('system');
    expect(L::dans($this->org, fn (): string => OwnerInvitation::query()->firstOrFail()->status->value))->toBe('revoked');
});

it('révoque les accès quand la fiche de la personne d\'un co-indivisaire est anonymisée', function (): void {
    $co = User::factory()->create(['email' => 'co@exemple.fr']);
    $acces = O::acces($this->org, $this->p['party'], $co, OwnerAccessRole::CoOwner);

    O::comme($this, $this->titulaire)->postJson("/api/v1/org/{$this->org->id}/parties/{$acces->person_party_id}/anonymization")->assertSuccessful();

    O::comme($this, $co)->getJson('/api/v1/owner/agencies')->assertForbidden();
    ($this->lire)()->assertOk();
});

it('révoque les accès du compte supprimé', function (): void {
    event(new AccountDeleted($this->p['user']->id));

    expect(L::dans($this->org, fn (): string => OwnerAccess::query()->firstOrFail()->revoked_by->value))->toBe('system');
    expect(L::dans($this->org, fn (): int => OwnerAccess::query()->where('status', 'active')->count()))->toBe(0);
});

it('sépare les profils d\'un compte à la fois locataire et propriétaire', function (): void {
    $double = T::locataire($this->org, [], [], $this->p['user']);

    O::comme($this, $this->p['user'])->getJson('/api/v1/me/profiles')->assertOk()
        ->assertJsonFragment(['space' => 'tenant'])->assertJsonFragment(['space' => 'owner']);
    O::comme($this, $this->p['user'])->getJson('/api/v1/tenant/leases')->assertOk()->assertJsonCount(1, 'data');
    ($this->lire)()->assertOk()->assertJsonCount(1, 'data');
    expect(json_encode(($this->lire)()->json(), JSON_THROW_ON_ERROR))->not->toContain($double['lease']->id);

    O::comme($this, $double['user'])->deleteJson('/api/v1/tenant/links/'.$double['party']->id)->assertNoContent();
    O::comme($this, $this->p['user'])->getJson('/api/v1/tenant/leases')->assertForbidden();
    ($this->lire)()->assertOk();

    $seulLocataire = T::locataire($this->org)['user'];
    O::comme($this, $seulLocataire)->getJson('/api/v1/owner/agencies')->assertForbidden();
    expect(O::comme($this, $seulLocataire)->getJson('/api/v1/tenant/links')->assertOk()->json('data'))->toHaveCount(1);
});

it('ne laisse un compte propriétaire d\'une agence rien lire d\'une autre agence où il n\'a aucun accès', function (): void {
    $autreOrg = T::organisation('Immo Loire');
    $autre = O::proprietaire($autreOrg, 'bob@exemple.fr');

    ($this->lire)()->assertOk()->assertJsonCount(1, 'data')->assertJsonMissing(['name' => $autreOrg->name]);
    expect(json_encode(($this->lire)()->json(), JSON_THROW_ON_ERROR))->not->toContain($autre['party']->id)->and(json_encode(($this->lire)()->json(), JSON_THROW_ON_ERROR))->not->toContain($autreOrg->id);
});

it('ajoute le limiteur dédié par IP, par compte et par jeton aux routes d\'acceptation', function (): void {
    foreach (['parties.owner-invitations.preview', 'parties.owner-invitations.accept'] as $nom) {
        $route = Route::getRoutes()->getByName($nom);
        expect($route?->gatherMiddleware())->toContain('throttle:auth', 'throttle:owner-invitation', 'verified', 'no-operator-token', 'auth:sanctum');
    }

    $request = Request::create('/api/v1/owner-invitations/acceptance', 'POST', ['token' => str_repeat('a', 48)], server: ['REMOTE_ADDR' => '10.0.0.9']);
    $limites = RateLimiter::limiter('owner-invitation')($request);
    $cles = array_map(fn ($l): string => $l->key, $limites);

    expect($limites)->toHaveCount(3)->and($cles[0])->toContain('10.0.0.9')->and($cles[2])->toContain(hash('sha256', str_repeat('a', 48)))->and($cles[2])->not->toContain(str_repeat('a', 48));
});

it('coupe l\'acceptation par le limiteur après des essais répétés depuis la même adresse', function (): void {
    $compte = User::factory()->create(['email' => 'rep@exemple.fr']);
    $corps = ['token' => str_repeat('b', 48), 'code' => '123456', 'consent' => true];
    $statuts = [];

    foreach (range(1, 8) as $i) {
        $statuts[] = O::comme($this, $compte)->postJson('/api/v1/owner-invitations/acceptance', $corps)->status();
    }

    expect($statuts)->toContain(429)->and(array_slice($statuts, 0, 5))->each->toBe(404);
});

it('envoie l\'invitation une seule fois et jamais à un autre destinataire que l\'adresse invitée', function (): void {
    O::comme($this, $this->titulaire)->postJson(O::urlAcces($this->org, $this->p['party']), ['role' => 'holder', 'identity_verified' => true, 'email' => 'Dest@Exemple.fr'])->assertCreated();

    Notification::assertSentOnDemandTimes(OwnerInvitationNotification::class, 1);
    Notification::assertSentOnDemand(OwnerInvitationNotification::class, fn ($n, $canaux, $notifiable): bool => $notifiable->routes['mail'] === 'dest@exemple.fr');
});

it('répond sans cache partagé : private, no-store sur l\'espace propriétaire et sur le code d\'appariement', function (): void {
    expect(($this->lire)()->headers->get('Cache-Control'))->toContain('no-store')->toContain('private');
    $reponse = O::comme($this, $this->titulaire)->postJson(O::urlAcces($this->org, $this->p['party']), ['role' => 'holder', 'identity_verified' => true, 'email' => 'n@exemple.fr'])->assertCreated();
    expect($reponse->headers->get('Cache-Control'))->toContain('no-store');
    expect(O::comme($this, $this->titulaire)->getJson(O::urlAcces($this->org, $this->p['party']))->headers->get('Cache-Control'))->toContain('no-store');
});

it('limite chaque route de l\'espace propriétaire et de l\'invitation côté agence', function (): void {
    $attendues = [
        'mandates.owner.agencies.index' => ['space:owner', 'throttle:60,1,owner-reads'],
        'parties.owner.links.index' => ['space:owner', 'throttle:30,1,owner-links'],
        'parties.owner.links.destroy' => ['space:owner', 'throttle:30,1,owner-links'],
        'parties.owner-access.show' => ['organization:owner,admin,manager', 'throttle:20,1'],
        'parties.owner-access.store' => ['organization:owner,admin,manager', 'throttle:20,1'],
        'parties.owner-access.destroy' => ['organization:owner,admin,manager', 'throttle:20,1'],
    ];

    foreach ($attendues as $nom => $middlewares) {
        $route = Route::getRoutes()->getByName($nom);
        expect($route?->gatherMiddleware())->toContain('auth:sanctum', ...$middlewares);

        if (str_starts_with($nom, 'mandates.owner') || str_starts_with($nom, 'parties.owner.')) {
            expect($route?->gatherMiddleware())->toContain('no-operator-token', 'verified');
        }
    }
});

it('coupe la lecture du sélecteur d\'agence au-delà de 60 requêtes par minute', function (): void {
    $statuts = [];

    foreach (range(1, 62) as $i) {
        $statuts[] = ($this->lire)()->status();
    }

    expect(array_slice($statuts, 0, 60))->each->toBe(200)->and($statuts[61])->toBe(429);
});

it('n\'expose que les champs utiles : aucune fiche d\'autrui, aucun identifiant du mandant', function (): void {
    $agencies = ($this->lire)()->assertOk()->json('data.0');
    $liens = ($this->lire)('/links')->assertOk()->json('data.0');

    expect(array_keys($agencies))->toBe(['access_id', 'role', 'agency', 'mandant', 'access_until', 'in_grace', 'read_only'])
        ->and(array_keys($agencies['agency']))->toBe(['id', 'name'])->and(array_keys($agencies['mandant']))->toBe(['name']);
    expect(array_keys($liens))->toBe(['id', 'role', 'organization', 'mandant', 'linked_at'])->and(array_keys($liens['mandant']))->toBe(['name']);
    $brut = json_encode([$agencies, $liens], JSON_THROW_ON_ERROR);
    expect($brut)->not->toContain($this->p['party']->id)->and($brut)->not->toContain('awa@exemple.fr')->and($brut)->not->toContain($this->p['user']->id);
});

it('marque le co-indivisaire en lecture seule dans le sélecteur', function (): void {
    $co = User::factory()->create(['email' => 'co@exemple.fr']);
    O::acces($this->org, $this->p['party'], $co, OwnerAccessRole::CoOwner);

    O::comme($this, $co)->getJson('/api/v1/owner/agencies')->assertOk()->assertJsonPath('data.0.role', 'co_owner')->assertJsonPath('data.0.read_only', true);
    ($this->lire)()->assertJsonPath('data.0.read_only', false);
});

it('empêche en base un accès dont l\'organisation ne porte pas le mandant', function (): void {
    $autreOrg = T::organisation('Immo Loire');

    expect(fn () => L::dans($autreOrg, fn () => OwnerAccess::factory()->create([
        'mandant_party_id' => $this->p['party']->id,
        'user_id' => User::factory()->create()->id,
    ])))->toThrow(QueryException::class);
});

it('empêche en base deux accès vivants du même compte sur le même mandant, mais autorise un accès révoqué puis un nouveau', function (): void {
    expect(fn () => O::acces($this->org, $this->p['party'], $this->p['user']))->toThrow(UniqueConstraintViolationException::class);

    O::comme($this, $this->p['user'])->deleteJson('/api/v1/owner/links/'.$this->p['access']->id)->assertNoContent();
    O::acces($this->org, $this->p['party'], $this->p['user']);
    ($this->lire)()->assertOk()->assertJsonCount(1, 'data');
});
