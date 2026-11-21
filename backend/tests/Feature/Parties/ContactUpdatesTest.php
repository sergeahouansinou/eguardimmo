<?php

declare(strict_types=1);

use App\Modules\Identity\Models\User;
use App\Modules\Parties\Actions\AddContactPoint;
use App\Modules\Parties\Actions\AnonymizeParty;
use App\Modules\Parties\Enums\ContactPointType;
use App\Modules\Parties\Models\ContactPoint;
use App\Modules\Parties\Models\ContactUpdateRequest;
use App\Modules\Parties\Queries\ContactUpdates;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\Feature\Leases\LeasesContext as L;
use Tests\Feature\Leases\LeasesReadContext as R;
use Tests\Feature\Tenant\TenantContext as T;
use Tests\Feature\Tenant\TenantWriteContext as W;

beforeEach(function (): void {
    $this->w = W::monde($this);
    $this->org = $this->w['org'];
    $this->moi = $this->w['moi'];
    $this->moi['user']->forceFill(['phone' => '+33612345678'])->save();
    $this->demander = fn (array $corps = [], $compte = null) => T::comme($this, $compte ?? $this->moi['user'])->postJson('/api/v1/tenant/contact-updates', [
        'organization_id' => $this->org->id,
        'fields' => ['email', 'phone'],
        'client_id' => (string) Str::uuid(),
        ...$corps,
    ]);
    $this->equipe = fn (string $chemin = '', string $methode = 'getJson', $compte = null) => R::changerDeCompte($this, $compte ?? $this->w['manager'])
        ->{$methode}("/api/v1/org/{$this->org->id}/parties/{$this->moi['party']->id}/contact-updates{$chemin}");
    $this->coordonnees = fn (): array => L::dans($this->org, fn (): array => ContactPoint::query()->where('party_id', $this->moi['party']->id)->where('is_primary', true)->pluck('value', 'type')->all());
});

it('lit les valeurs sur le compte, jamais dans la requête, et ne les rend pas au locataire', function (): void {
    $reponse = ($this->demander)(['email' => 'pirate@exemple.fr', 'phone' => '+33999999999'])->assertCreated()
        ->assertJsonPath('data.status', 'pending')->assertJsonPath('data.organization_id', $this->org->id);

    expect(array_keys($reponse->json('data')))->toBe(['id', 'organization_id', 'status', 'created_at', 'decided_at'])
        ->and(json_encode($reponse->json()))->not->toContain($this->moi['party']->id)->not->toContain('pirate');

    $demande = L::dans($this->org, fn () => ContactUpdateRequest::query()->first());
    expect($demande->email)->toBe(mb_strtolower($this->moi['user']->email))->and($demande->phone)->toBe('+33612345678')
        ->and(DB::table('contact_update_requests')->value('email'))->not->toContain('@')
        ->and(DB::table('contact_update_requests')->value('phone'))->not->toContain('612345678')
        ->and(W::actions())->toContain('parties.contact_update.requested');
});

it('rejoue une demande identique sans en créer une seconde et refuse un contenu différent', function (): void {
    $cle = (string) Str::uuid();
    $premiere = ($this->demander)(['client_id' => $cle])->assertCreated()->json('data.id');
    ($this->demander)(['client_id' => $cle])->assertOk()->assertJsonPath('data.id', $premiere);
    ($this->demander)(['client_id' => $cle, 'fields' => ['email']])->assertConflict()->assertJsonPath('code', 'idempotency_key_reused');

    expect(L::dans($this->org, fn () => ContactUpdateRequest::query()->count()))->toBe(1);
});

it('écarte la demande précédente encore en attente quand une nouvelle arrive', function (): void {
    $premiere = ($this->demander)()->assertCreated()->json('data.id');
    ($this->demander)(['fields' => ['email']])->assertCreated();

    $anciennes = L::dans($this->org, fn () => ContactUpdateRequest::query()->whereKey($premiere)->first());
    expect($anciennes->status->value)->toBe('dismissed')->and($anciennes->email)->toBeNull()->and($anciennes->phone)->toBeNull();
});

it('refuse les entrées invalides et une organisation sans fiche rattachée', function (): void {
    ($this->demander)(['fields' => []])->assertUnprocessable();
    ($this->demander)(['fields' => ['name']])->assertUnprocessable();
    ($this->demander)(['client_id' => 'pas-un-uuid'])->assertUnprocessable();
    ($this->demander)(['organization_id' => (string) Str::uuid()])->assertNotFound()->assertJsonPath('code', 'contact_update_not_found');

    $autre = T::organisation('Autre agence');
    ($this->demander)(['organization_id' => $autre->id])->assertNotFound();

    $sansTelephone = User::factory()->create(['phone' => null]);
    $monde = T::locataire($this->org, compte: $sansTelephone);
    ($this->demander)(['fields' => ['phone']], $monde['user'])->assertUnprocessable()->assertJsonPath('code', 'contact_update_empty');
});

it('liste les demandes du compte seulement et exige un compte locataire authentifié', function (): void {
    ($this->demander)()->assertCreated();
    $autre = T::locataire($this->org);
    ($this->demander)([], $autre['user'])->assertCreated();

    $liste = T::comme($this, $this->moi['user'])->getJson('/api/v1/tenant/contact-updates')->assertOk();
    expect($liste->json('data'))->toHaveCount(1);

    T::comme($this, User::factory()->create())->getJson('/api/v1/tenant/contact-updates')->assertForbidden()->assertJsonPath('code', 'space_forbidden');
    T::comme($this, User::factory()->create())->postJson('/api/v1/tenant/contact-updates', [])->assertForbidden();
    T::comme($this, null)->getJson('/api/v1/tenant/contact-updates')->assertUnauthorized();
    T::comme($this, null)->postJson('/api/v1/tenant/contact-updates', [])->assertUnauthorized();
});

it('limite à cinq demandes par jour', function (): void {
    foreach (range(1, 5) as $_) {
        ($this->demander)()->assertSuccessful();
    }
    ($this->demander)()->assertStatus(429);
});

it('laisse l\'équipe voir puis appliquer la demande : les valeurs deviennent principales puis sont effacées', function (): void {
    ($this->demander)()->assertCreated();

    $vue = ($this->equipe)()->assertOk();
    expect($vue->json('data.0'))->toMatchArray(['status' => 'pending', 'email' => mb_strtolower($this->moi['user']->email), 'phone' => '+33612345678']);
    $id = $vue->json('data.0.id');

    ($this->equipe)("/{$id}/apply", 'postJson')->assertOk()->assertJsonPath('data.status', 'applied')->assertJsonPath('data.email', null)->assertJsonPath('data.phone', null);

    expect(($this->coordonnees)())->toMatchArray(['email' => mb_strtolower($this->moi['user']->email), 'phone' => '+33612345678'])
        ->and(DB::table('contact_update_requests')->whereNotNull('email')->orWhereNotNull('phone')->count())->toBe(0)
        ->and(W::actions())->toContain('parties.contact_update.applied');

    ($this->equipe)("/{$id}/apply", 'postJson')->assertConflict()->assertJsonPath('code', 'contact_update_not_pending');
    ($this->equipe)("/{$id}/dismiss", 'postJson')->assertConflict();
});

it('ne duplique pas une coordonnée déjà portée par la fiche et la rend principale', function (): void {
    $ancienne = L::dans($this->org, fn () => app(AddContactPoint::class)->handle($this->moi['party'], ContactPointType::Phone, '+33600000000', null, true));
    L::dans($this->org, fn () => app(AddContactPoint::class)->handle($this->moi['party'], ContactPointType::Phone, '+33612345678', null, false));
    ($this->demander)(['fields' => ['phone']])->assertCreated();
    $id = ($this->equipe)()->json('data.0.id');

    ($this->equipe)("/{$id}/apply", 'postJson')->assertOk();

    expect(($this->coordonnees)()['phone'])->toBe('+33612345678')
        ->and(L::dans($this->org, fn () => ContactPoint::query()->where('party_id', $this->moi['party']->id)->where('type', 'phone')->count()))->toBe(2)
        ->and($ancienne)->not->toBeNull();
});

it('laisse l\'équipe écarter la demande sans toucher aux coordonnées', function (): void {
    $avant = ($this->coordonnees)();
    ($this->demander)()->assertCreated();
    $id = ($this->equipe)()->json('data.0.id');

    ($this->equipe)("/{$id}/dismiss", 'postJson')->assertOk()->assertJsonPath('data.status', 'dismissed')->assertJsonPath('data.email', null);

    expect(($this->coordonnees)())->toBe($avant);
    T::comme($this, $this->moi['user'])->getJson('/api/v1/tenant/contact-updates')->assertOk()->assertJsonPath('data.0.status', 'dismissed');
});

it('réserve le traitement aux rôles de gestion et cloisonne les organisations', function (): void {
    ($this->demander)()->assertCreated();
    $id = ($this->equipe)()->json('data.0.id');

    ($this->equipe)('', 'getJson', $this->w['accountant'])->assertForbidden();
    ($this->equipe)("/{$id}/apply", 'postJson', $this->w['accountant'])->assertForbidden();
    ($this->equipe)("/{$id}/dismiss", 'postJson', $this->w['accountant'])->assertForbidden();

    $autre = T::organisation('Autre agence');
    $intrus = L::titulaire($autre);
    R::changerDeCompte($this, $intrus)->getJson("/api/v1/org/{$this->org->id}/parties/{$this->moi['party']->id}/contact-updates")->assertStatus(404);
    R::changerDeCompte($this, $intrus)->postJson("/api/v1/org/{$this->org->id}/parties/{$this->moi['party']->id}/contact-updates/{$id}/apply")->assertStatus(404);

    $autrePartie = T::locataire($this->org);
    R::changerDeCompte($this, $this->w['manager'])->postJson("/api/v1/org/{$this->org->id}/parties/{$autrePartie['party']->id}/contact-updates/{$id}/apply")->assertNotFound()->assertJsonPath('code', 'contact_update_not_found');

    auth()->forgetGuards();
    $this->getJson("/api/v1/org/{$this->org->id}/parties/{$this->moi['party']->id}/contact-updates")->assertUnauthorized();
    expect(L::dans($this->org, fn () => ContactUpdateRequest::query()->first()->status->value))->toBe('pending');
});

it('purge les demandes de plus de 90 jours et les supprime avec l\'anonymisation de la fiche', function (): void {
    ($this->demander)()->assertCreated();
    $this->travel(91)->days();
    $this->artisan('parties:purge-contact-updates')->assertSuccessful();
    expect(DB::table('contact_update_requests')->count())->toBe(0);

    $this->travelTo(now()->subDays(91));
    ($this->demander)()->assertCreated();
    expect(app(ContactUpdates::class)->purge(now()))->toBe(0);

    L::dans($this->org, fn () => app(AnonymizeParty::class)->handle($this->moi['party'], 'requested'));
    expect(DB::table('contact_update_requests')->count())->toBe(0);
});
