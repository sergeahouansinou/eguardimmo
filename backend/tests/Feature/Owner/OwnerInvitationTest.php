<?php

declare(strict_types=1);

use App\Modules\Identity\Models\OwnerInvitation;
use App\Modules\Identity\Models\User;
use App\Modules\Identity\Notifications\OwnerInvitationNotification;
use App\Modules\Parties\Models\OwnerAccess;
use App\Shared\Audit\AuditLog;
use Carbon\CarbonImmutable;
use Illuminate\Routing\Middleware\ThrottleRequests;
use Illuminate\Support\Facades\Notification;
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
    $this->mandant = O::mandant($this->org);
    O::mandat($this->org, $this->mandant);
    $this->compte = User::factory()->create(['email' => 'awa@exemple.fr']);

    $this->inviter = function (?array $corps = null, $partie = null): array {
        O::preuve($this);
        $reponse = O::comme($this, $this->titulaire)->postJson(O::urlAcces($this->org, $partie ?? $this->mandant), $corps ?? ['role' => 'holder', 'identity_verified' => true])
            ->assertCreated();
        $jeton = '';
        Notification::assertSentOnDemand(OwnerInvitationNotification::class, function (OwnerInvitationNotification $n) use (&$jeton): bool {
            $jeton = basename($n->acceptUrl);

            return true;
        });

        return ['token' => $jeton, 'code' => (string) $reponse->json('data.pairing_code'), 'invitation' => $reponse->json('data.invitation')];
    };
    $this->accepter = fn (array $invit, ?User $compte = null, array $corps = []) => O::comme($this, $compte ?? $this->compte)
        ->withoutMiddleware(ThrottleRequests::class)
        ->postJson('/api/v1/owner-invitations/acceptance', ['token' => $invit['token'], 'code' => $invit['code'], 'consent' => true, ...$corps]);
    $this->invitationActuelle = fn (): OwnerInvitation => L::dans($this->org, fn (): OwnerInvitation => OwnerInvitation::query()->latest('created_at')->firstOrFail());
});

it('invite, prévisualise, apparie puis liste le mandant : parcours nominal avec profil, audit et agence', function (): void {
    $invit = ($this->inviter)();

    expect($invit['token'])->toHaveLength(48)->and($invit['code'])->toMatch('/^\d{6}$/');
    expect($invit['invitation'])->toMatchArray(['role' => 'holder', 'email_hint' => 'a***@exemple.fr', 'attempts_remaining' => 5]);

    O::comme($this, $this->compte)->getJson('/api/v1/me/profiles')->assertOk()->assertJsonCount(0, 'data');
    O::comme($this, $this->compte)->getJson('/api/v1/owner/agencies')->assertForbidden()->assertJsonPath('code', 'space_forbidden');

    O::comme($this, $this->compte)->postJson('/api/v1/owner-invitations/preview', ['token' => $invit['token']])
        ->assertOk()->assertExactJson(['data' => ['organization' => ['name' => 'Agence du Port'], 'role' => 'holder', 'expires_at' => now()->addDays(7)->toIso8601String()]]);

    ($this->accepter)($invit)->assertCreated()
        ->assertJsonPath('data.role', 'holder')->assertJsonPath('data.organization.name', 'Agence du Port')
        ->assertJsonPath('data.owner_link_id', L::dans($this->org, fn (): string => OwnerAccess::query()->firstOrFail()->id));

    O::comme($this, $this->compte)->getJson('/api/v1/me/profiles')->assertOk()->assertJsonFragment(['space' => 'owner', 'label' => 'Propriétaire mandant']);
    O::comme($this, $this->compte)->getJson('/api/v1/owner/links')->assertOk()
        ->assertJsonPath('data.0.role', 'holder')->assertJsonPath('data.0.organization.name', 'Agence du Port')->assertJsonPath('data.0.mandant.name', $this->mandant->display_name);
    O::comme($this, $this->compte)->getJson('/api/v1/owner/agencies')->assertOk()
        ->assertJsonCount(1, 'data')->assertJsonPath('data.0.agency.id', $this->org->id)->assertJsonPath('data.0.in_grace', false)
        ->assertJsonPath('data.0.read_only', false)->assertJsonPath('data.0.access_until', null);

    O::comme($this, $this->titulaire)->getJson(O::urlAcces($this->org, $this->mandant))->assertOk()
        ->assertJsonCount(1, 'data.accesses')->assertJsonCount(0, 'data.invitations')
        ->assertJsonPath('data.accesses.0.email_hint', 'a***@exemple.fr')->assertJsonPath('data.accesses.0.role', 'holder');

    $invitation = ($this->invitationActuelle)();
    expect($invitation->token_hash)->toBeNull()->and($invitation->code_hash)->toBeNull()
        ->and($invitation->accepted_by_user_id)->toBe($this->compte->id)->and($invitation->consent_version)->toBe(OwnerInvitation::CONSENT_VERSION);
    $acces = L::dans($this->org, fn (): OwnerAccess => OwnerAccess::query()->firstOrFail());
    expect($acces->identity_attested_by_user_id)->toBe($this->titulaire->id)->and($acces->invitation_id)->toBe($invitation->id)
        ->and($acces->consent_version)->toBe(OwnerInvitation::CONSENT_VERSION);

    expect(AuditLog::query()->pluck('action')->all())->toContain('identity.owner_invitation.issued', 'identity.owner_invitation.accepted', 'parties.owner_access.linked');
});

it('ne met jamais le code d\'appariement dans l\'e-mail, ni le jeton ou le code dans l\'audit', function (): void {
    $invit = ($this->inviter)();
    ($this->accepter)($invit)->assertCreated();

    Notification::assertSentOnDemand(OwnerInvitationNotification::class, function (OwnerInvitationNotification $n) use ($invit): bool {
        $texte = json_encode($n->toMail(new stdClass)->toArray(), JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES);

        return ! str_contains($texte, $invit['code']) && str_contains($texte, '/invitation-proprietaire/'.$invit['token']);
    });

    $journal = json_encode(AuditLog::query()->get()->map(fn (AuditLog $l): array => [$l->metadata, $l->changes])->all(), JSON_THROW_ON_ERROR);
    expect($journal)->not->toContain($invit['token'])->and($journal)->not->toContain('"'.$invit['code'].'"')
        ->and($journal)->not->toContain('awa@exemple.fr')->and($journal)->not->toContain(hash('sha256', $invit['token']));
});

it('hache le jeton et le code en base et ne renvoie le code qu\'une fois', function (): void {
    $invit = ($this->inviter)();
    $invitation = ($this->invitationActuelle)();

    expect($invitation->token_hash)->toBe(hash('sha256', $invit['token']))->and($invitation->code_hash)->toHaveLength(64)->and($invitation->code_hash)->not->toContain($invit['code']);
    $etat = O::comme($this, $this->titulaire)->getJson(O::urlAcces($this->org, $this->mandant))->assertOk();
    expect($etat->getContent())->not->toContain($invit['code'])->and($etat->getContent())->not->toContain($invit['token'])->and($etat->getContent())->not->toContain('awa@exemple.fr');
    $etat->assertJsonPath('data.invitations.0.attempts_remaining', 5)->assertJsonPath('data.invitations.0.email_hint', 'a***@exemple.fr');
});

it('invite l\'adresse indiquée plutôt que l\'e-mail principal et refuse un autre compte', function (): void {
    $invit = ($this->inviter)(['role' => 'holder', 'identity_verified' => true, 'email' => 'Autre@Exemple.fr']);
    $autre = User::factory()->create(['email' => 'autre@exemple.fr']);

    ($this->accepter)($invit, $this->compte)->assertForbidden()->assertJsonPath('code', 'owner_invitation_email_mismatch');
    O::comme($this, $this->compte)->postJson('/api/v1/owner-invitations/preview', ['token' => $invit['token']])->assertForbidden();
    ($this->accepter)($invit, $autre)->assertCreated();
});

it('refuse un compte à l\'adresse non vérifiée puis accepte une fois confirmée', function (): void {
    $invit = ($this->inviter)();
    $this->compte->forceFill(['email_verified_at' => null])->save();

    ($this->accepter)($invit)->assertForbidden();
    $this->compte->forceFill(['email_verified_at' => now()])->save();
    ($this->accepter)($invit)->assertCreated();
});

it('exige le consentement et un code de six chiffres sans consommer d\'essai', function (): void {
    $invit = ($this->inviter)();

    ($this->accepter)($invit, null, ['consent' => false])->assertUnprocessable()->assertJsonValidationErrors('consent');
    ($this->accepter)($invit, null, ['code' => '12'])->assertUnprocessable()->assertJsonValidationErrors('code');
    ($this->accepter)($invit, null, ['code' => 'abcdef'])->assertUnprocessable();
    O::comme($this, $this->compte)->postJson('/api/v1/owner-invitations/acceptance', ['token' => $invit['token'], 'consent' => true])->assertUnprocessable();

    expect(($this->invitationActuelle)()->code_attempts)->toBe(0);
    ($this->accepter)($invit)->assertCreated();
});

it('rejette un jeton rejoué, inconnu, expiré, révoqué ou bloqué par la même réponse', function (): void {
    $rejoue = ($this->inviter)();
    ($this->accepter)($rejoue)->assertCreated();
    $reponses = [($this->accepter)($rejoue)];
    $reponses[] = ($this->accepter)(['token' => str_repeat('a', 48), 'code' => '123456']);

    Notification::fake();
    $expire = ($this->inviter)(['role' => 'holder', 'identity_verified' => true, 'email' => 'exp@exemple.fr']);
    $compteExpire = User::factory()->create(['email' => 'exp@exemple.fr']);
    $this->travelTo(now()->addDays(7)->addSecond());
    $this->flushSession();
    $reponses[] = ($this->accepter)($expire, $compteExpire);
    $this->travelTo(CarbonImmutable::parse(O::AUJOURDHUI));

    Notification::fake();
    $revoque = ($this->inviter)(['role' => 'holder', 'identity_verified' => true, 'email' => 'rev@exemple.fr']);
    $compteRevoque = User::factory()->create(['email' => 'rev@exemple.fr']);
    $id = L::dans($this->org, fn (): string => OwnerInvitation::query()->where('email', 'rev@exemple.fr')->firstOrFail()->id);
    O::comme($this, $this->titulaire)->deleteJson(O::urlAcces($this->org, $this->mandant, '/'.$id))->assertNoContent();
    $reponses[] = ($this->accepter)($revoque, $compteRevoque);

    Notification::fake();
    $bloque = ($this->inviter)(['role' => 'holder', 'identity_verified' => true, 'email' => 'blo@exemple.fr']);
    $compteBloque = User::factory()->create(['email' => 'blo@exemple.fr']);
    for ($i = 0; $i < 5; $i++) {
        ($this->accepter)([...$bloque, 'code' => $bloque['code'] === '000000' ? '000001' : '000000'], $compteBloque)->assertUnprocessable();
        $this->app['cache']->store()->flush();
    }
    $reponses[] = ($this->accepter)($bloque, $compteBloque);

    foreach ($reponses as $reponse) {
        $reponse->assertNotFound()->assertJsonPath('code', 'owner_invitation_invalid');
    }
    expect(collect($reponses)->map(fn ($r): array => [$r->json('title'), $r->json('detail'), $r->json('status')])->unique()->count())->toBe(1);
});

it('compte les essais du code, bloque à la cinquième erreur et ne distingue plus ensuite', function (): void {
    $invit = ($this->inviter)();
    $faux = $invit['code'] === '000000' ? '000001' : '000000';

    for ($i = 1; $i <= 4; $i++) {
        ($this->accepter)([...$invit, 'code' => $faux])->assertUnprocessable()->assertJsonPath('code', 'owner_invitation_code_invalid');
        $this->app['cache']->store()->flush();
        O::comme($this, $this->titulaire)->getJson(O::urlAcces($this->org, $this->mandant))->assertJsonPath('data.invitations.0.attempts_remaining', 5 - $i);
    }

    ($this->accepter)([...$invit, 'code' => $faux])->assertUnprocessable()->assertJsonPath('code', 'owner_invitation_code_invalid');
    $this->app['cache']->store()->flush();

    ($this->accepter)($invit)->assertNotFound()->assertJsonPath('code', 'owner_invitation_invalid');
    $invitation = ($this->invitationActuelle)();
    expect($invitation->status->value)->toBe('blocked')->and($invitation->token_hash)->toBeNull()->and($invitation->code_hash)->toBeNull();
    expect(L::dans($this->org, fn (): int => OwnerAccess::query()->count()))->toBe(0);
    expect(AuditLog::query()->pluck('action')->all())->toContain('identity.owner_invitation.blocked');
    O::comme($this, $this->compte)->postJson('/api/v1/owner-invitations/preview', ['token' => $invit['token']])->assertNotFound();
});

it('accepte le bon code après quelques erreurs, sans avoir bloqué l\'invitation', function (): void {
    $invit = ($this->inviter)();
    $faux = $invit['code'] === '000000' ? '000001' : '000000';

    ($this->accepter)([...$invit, 'code' => $faux])->assertUnprocessable();
    ($this->accepter)([...$invit, 'code' => $faux])->assertUnprocessable();
    ($this->accepter)($invit)->assertCreated();
});

it('annule l\'acceptation entière quand la création de l\'accès échoue, sans consommer l\'invitation', function (): void {
    $invit = ($this->inviter)();
    L::dans($this->org, fn () => OwnerAccess::query()->create([
        'mandant_party_id' => $this->mandant->id, 'user_id' => $this->compte->id, 'role' => 'holder', 'status' => 'active',
        'invitation_id' => (string) Str::uuid7(), 'consent_version' => '2026-11', 'consented_at' => now(),
        'identity_attested_by_user_id' => $this->titulaire->id, 'identity_attested_at' => now(),
    ]));

    ($this->accepter)($invit)->assertConflict()->assertJsonPath('code', 'owner_access_already_linked');
    expect(($this->invitationActuelle)()->status->value)->toBe('pending');
});

it('remplace une invitation en attente : l\'ancien jeton et l\'ancien code cessent de valoir', function (): void {
    $ancien = ($this->inviter)();
    Notification::fake();
    $nouveau = ($this->inviter)();

    expect($nouveau['token'])->not->toBe($ancien['token']);
    ($this->accepter)($ancien)->assertNotFound();
    ($this->accepter)([...$nouveau, 'code' => $ancien['code'] === $nouveau['code'] ? '000000' : $ancien['code']])->assertUnprocessable();
    ($this->accepter)($nouveau)->assertCreated();
    expect(L::dans($this->org, fn (): int => OwnerInvitation::query()->where('status', 'revoked')->count()))->toBe(1);
});

it('plafonne à cinq les accès et invitations d\'un mandant, une réinvitation de la même adresse remplaçant sans compter', function (): void {
    foreach (range(1, 5) as $i) {
        Notification::fake();
        ($this->inviter)(['role' => 'holder', 'identity_verified' => true, 'email' => "p{$i}@exemple.fr"]);
    }

    O::comme($this, $this->titulaire)->postJson(O::urlAcces($this->org, $this->mandant), ['role' => 'holder', 'identity_verified' => true, 'email' => 'p6@exemple.fr'])
        ->assertConflict()->assertJsonPath('code', 'owner_access_limit_reached');
    O::comme($this, $this->titulaire)->postJson(O::urlAcces($this->org, $this->mandant), ['role' => 'holder', 'identity_verified' => true, 'email' => 'p1@exemple.fr'])->assertCreated();
});

it('refuse l\'acceptation au-delà du plafond même si les invitations étaient émises avant', function (): void {
    $invit = ($this->inviter)();
    foreach (range(1, 5) as $i) {
        O::acces($this->org, $this->mandant, User::factory()->create());
    }

    ($this->accepter)($invit)->assertConflict()->assertJsonPath('code', 'owner_access_limit_reached');
    expect(($this->invitationActuelle)()->status->value)->toBe('pending');
});

it('relie une personne à sa société et à sa fiche : deux accès du même compte chez la même agence', function (): void {
    $societe = O::mandant($this->org, 'sci@exemple.fr', true);
    O::mandat($this->org, $societe);
    $invitPersonne = ($this->inviter)();
    ($this->accepter)($invitPersonne)->assertCreated();

    Notification::fake();
    $invitSociete = ($this->inviter)(['role' => 'representative', 'identity_verified' => true, 'powers_verified' => true, 'email' => 'awa@exemple.fr'], $societe);
    ($this->accepter)($invitSociete)->assertCreated();

    O::comme($this, $this->compte)->getJson('/api/v1/owner/agencies')->assertOk()->assertJsonCount(2, 'data')
        ->assertJsonFragment(['role' => 'holder'])->assertJsonFragment(['role' => 'representative']);
    O::comme($this, $this->compte)->getJson('/api/v1/owner/links')->assertOk()->assertJsonCount(2, 'data');
});

it('valide le rôle selon la nature du contact et exige la fiche d\'un co-indivisaire', function (): void {
    $societe = O::mandant($this->org, 'sci@exemple.fr', true);
    $personne = O::mandant($this->org, 'co@exemple.fr');
    $url = fn ($p) => O::urlAcces($this->org, $p);
    $c = O::comme($this, $this->titulaire);

    $c->postJson($url($this->mandant), ['role' => 'representative', 'identity_verified' => true, 'powers_verified' => true])->assertUnprocessable()->assertJsonPath('code', 'owner_access_role_invalid');
    $c->postJson($url($societe), ['role' => 'holder', 'identity_verified' => true, 'email' => 'x@exemple.fr'])->assertUnprocessable()->assertJsonPath('code', 'owner_access_role_invalid');
    $c->postJson($url($this->mandant), ['role' => 'co_owner', 'identity_verified' => true])->assertUnprocessable()->assertJsonPath('code', 'owner_access_role_invalid');
    $c->postJson($url($this->mandant), ['role' => 'co_owner', 'identity_verified' => true, 'person_party_id' => $this->mandant->id])->assertUnprocessable()->assertJsonPath('code', 'owner_access_role_invalid');
    $c->postJson($url($this->mandant), ['role' => 'holder', 'identity_verified' => true, 'person_party_id' => $personne->id])->assertUnprocessable()->assertJsonPath('code', 'owner_access_role_invalid');
    $c->postJson($url($this->mandant), ['role' => 'co_owner', 'identity_verified' => true, 'person_party_id' => $societe->id])->assertNotFound()->assertJsonPath('code', 'party_not_found');
    $c->postJson($url($this->mandant), ['role' => 'co_owner', 'identity_verified' => true, 'person_party_id' => (string) Str::uuid7()])->assertNotFound();
    $c->postJson($url($this->mandant), ['role' => 'nimporte', 'identity_verified' => true])->assertUnprocessable()->assertJsonValidationErrors('role');

    $c->postJson($url($this->mandant), ['role' => 'co_owner', 'identity_verified' => true, 'person_party_id' => $personne->id])->assertCreated()
        ->assertJsonPath('data.invitation.role', 'co_owner')->assertJsonPath('data.invitation.person_party_id', $personne->id)->assertJsonPath('data.invitation.email_hint', 'c***@exemple.fr');
});

it('exige l\'attestation d\'identité du mandant et des pouvoirs du représentant', function (): void {
    $societe = O::mandant($this->org, 'sci@exemple.fr', true);
    $c = O::comme($this, $this->titulaire);

    $c->postJson(O::urlAcces($this->org, $this->mandant), ['role' => 'holder'])->assertUnprocessable()->assertJsonPath('code', 'owner_identity_attestation_required');
    $c->postJson(O::urlAcces($this->org, $this->mandant), ['role' => 'holder', 'identity_verified' => false])->assertUnprocessable()->assertJsonPath('code', 'owner_identity_attestation_required');
    $c->postJson(O::urlAcces($this->org, $societe), ['role' => 'representative', 'identity_verified' => true])->assertUnprocessable()->assertJsonPath('code', 'owner_identity_attestation_required');
    expect(L::dans($this->org, fn (): int => OwnerInvitation::query()->count()))->toBe(0);
    Notification::assertNothingSent();
});

it('refuse d\'inviter sans adresse, un contact archivé ou anonymisé', function (): void {
    $sansEmail = T::partie($this->org);
    $archive = T::partie($this->org, ['archived_at' => now()]);
    $anonyme = T::partie($this->org, ['anonymized_at' => now()]);
    $c = O::comme($this, $this->titulaire);

    $c->postJson(O::urlAcces($this->org, $sansEmail), ['role' => 'holder', 'identity_verified' => true])->assertUnprocessable()->assertJsonPath('code', 'owner_access_email_required');
    $c->postJson(O::urlAcces($this->org, $archive), ['role' => 'holder', 'identity_verified' => true, 'email' => 'a@exemple.fr'])->assertConflict()->assertJsonPath('code', 'owner_access_party_archived');
    $c->postJson(O::urlAcces($this->org, $anonyme), ['role' => 'holder', 'identity_verified' => true, 'email' => 'a@exemple.fr'])->assertConflict()->assertJsonPath('code', 'party_anonymized');
    $c->postJson(O::urlAcces($this->org, $this->mandant), ['role' => 'holder', 'identity_verified' => true, 'email' => 'pas-un-email'])->assertUnprocessable();
});

it('ne laisse jamais le client fixer le compte, l\'organisation ou le statut', function (): void {
    $autreOrg = T::organisation('Immo Loire');
    $intrus = User::factory()->create();
    O::comme($this, $this->titulaire)->postJson(O::urlAcces($this->org, $this->mandant), [
        'role' => 'holder', 'identity_verified' => true, 'user_id' => $intrus->id, 'organization_id' => $autreOrg->id,
        'status' => 'active', 'token' => 'x', 'code_hash' => 'x', 'mandant_party_id' => (string) Str::uuid7(),
    ])->assertCreated();

    $invitation = ($this->invitationActuelle)();
    expect($invitation->organization_id)->toBe($this->org->id)->and($invitation->mandant_party_id)->toBe($this->mandant->id)->and($invitation->status->value)->toBe('pending');
    expect(L::dans($this->org, fn (): int => OwnerAccess::query()->count()))->toBe(0);
});
