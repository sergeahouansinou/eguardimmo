<?php

declare(strict_types=1);

use App\Modules\Identity\Models\TenantInvitation;
use App\Modules\Identity\Models\User;
use App\Modules\Identity\Notifications\TenantInvitationNotification;
use App\Modules\Identity\PublicApi\TenantInvitations;
use App\Modules\Organizations\Enums\MemberRole;
use App\Modules\Parties\Models\Party;
use App\Shared\Audit\AuditLog;
use App\Shared\Http\ApiProblem;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Notification;
use Tests\Feature\Leases\LeasesContext as L;
use Tests\Feature\Tenant\TenantContext as T;

beforeEach(function (): void {
    Notification::fake();
    L::semer();
    $this->travelTo(CarbonImmutable::parse(T::AUJOURDHUI));
    $this->org = T::organisation();
    $this->titulaire = L::titulaire($this->org);
    $this->partie = T::partie($this->org);
    T::emailPrincipal($this->org, $this->partie, 'koffi@exemple.fr');
    $this->compte = User::factory()->create(['email' => 'koffi@exemple.fr']);
    $this->urlAcces = fn (?Party $p = null): string => "/api/v1/org/{$this->org->id}/parties/".($p ?? $this->partie)->id.'/tenant-access';
    $this->inviter = function (?Party $p = null, array $corps = []): string {
        T::comme($this, $this->titulaire)->postJson(($this->urlAcces)($p), $corps)->assertCreated()->assertJsonPath('data.status', 'invited');
        $jeton = '';
        Notification::assertSentOnDemand(TenantInvitationNotification::class, function (TenantInvitationNotification $n) use (&$jeton): bool {
            $jeton = basename($n->acceptUrl);

            return true;
        });

        return $jeton;
    };
    $this->accepter = fn (string $jeton, ?User $compte = null, array $corps = []) => T::comme($this, $compte ?? $this->compte)
        ->postJson('/api/v1/tenant-invitations/acceptance', ['token' => $jeton, 'consent' => true, ...$corps]);
    $this->partieActuelle = fn (): Party => L::dans($this->org, fn (): Party => Party::query()->findOrFail($this->partie->id));
});

it('invite, prévisualise puis rattache le compte après consentement, avec le profil locataire et l\'audit', function (): void {
    $jeton = ($this->inviter)();
    expect($jeton)->toHaveLength(48);

    T::comme($this, $this->compte)->getJson('/api/v1/me/profiles')->assertOk()->assertJsonCount(0, 'data');
    T::comme($this, $this->compte)->postJson('/api/v1/tenant-invitations/preview', ['token' => $jeton])
        ->assertOk()->assertExactJson(['data' => ['organization' => ['name' => 'Agence du Port'], 'expires_at' => now()->addDays(7)->toIso8601String()]]);

    ($this->accepter)($jeton)->assertCreated()->assertJsonPath('data.tenant_link_id', $this->partie->id);

    expect(($this->partieActuelle)()->user_id)->toBe($this->compte->id);
    T::comme($this, $this->compte)->getJson('/api/v1/me/profiles')->assertOk()->assertJsonFragment(['space' => 'tenant', 'label' => 'Locataire']);
    T::comme($this, $this->compte)->getJson('/api/v1/tenant/links')->assertOk()
        ->assertJsonPath('data.0.id', $this->partie->id)->assertJsonPath('data.0.organization.name', 'Agence du Port');
    T::comme($this, $this->titulaire)->getJson(($this->urlAcces)())->assertOk()->assertJsonPath('data.status', 'linked')->assertJsonPath('data.email_hint', 'k***@exemple.fr');

    $actions = AuditLog::query()->pluck('action')->all();
    expect($actions)->toContain('identity.tenant_invitation.issued', 'identity.tenant_invitation.accepted', 'parties.tenant_access.linked');
    $invitation = L::dans($this->org, fn (): TenantInvitation => TenantInvitation::query()->firstOrFail());
    expect($invitation->consent_version)->toBe(TenantInvitation::CONSENT_VERSION)->and($invitation->token_hash)->toBeNull()->and($invitation->accepted_by_user_id)->toBe($this->compte->id);
});

it('invite l\'adresse indiquée plutôt que l\'e-mail principal', function (): void {
    $jeton = ($this->inviter)(null, ['email' => 'Autre@Exemple.fr']);
    $autre = User::factory()->create(['email' => 'autre@exemple.fr']);

    ($this->accepter)($jeton, $this->compte)->assertForbidden()->assertJsonPath('code', 'tenant_invitation_email_mismatch');
    ($this->accepter)($jeton, $autre)->assertCreated();
});

it('refuse un compte dont l\'adresse n\'est pas celle invitée, sans rien rattacher', function (): void {
    $jeton = ($this->inviter)();
    $intrus = User::factory()->create(['email' => 'intrus@exemple.fr']);

    ($this->accepter)($jeton, $intrus)->assertForbidden()->assertJsonPath('code', 'tenant_invitation_email_mismatch');
    T::comme($this, $intrus)->postJson('/api/v1/tenant-invitations/preview', ['token' => $jeton])->assertForbidden();
    expect(($this->partieActuelle)()->user_id)->toBeNull();
});

it('refuse un compte à l\'adresse non vérifiée, par la route comme par l\'API publique', function (): void {
    $jeton = ($this->inviter)();
    $this->compte->forceFill(['email_verified_at' => null])->save();

    ($this->accepter)($jeton)->assertForbidden();
    expect(fn () => app(TenantInvitations::class)->consume($this->compte->id, $jeton, true))
        ->toThrow(fn (ApiProblem $p): bool => $p->problemCode === 'email_unverified');
    expect(fn () => app(TenantInvitations::class)->preview($this->compte->id, $jeton))
        ->toThrow(fn (ApiProblem $p): bool => $p->problemCode === 'email_unverified');
    expect(($this->partieActuelle)()->user_id)->toBeNull();

    $this->compte->forceFill(['email_verified_at' => now()])->save();
    ($this->accepter)($jeton)->assertCreated();
});

it('exige le consentement explicite', function (): void {
    $jeton = ($this->inviter)();

    ($this->accepter)($jeton, null, ['consent' => false])->assertUnprocessable()->assertJsonValidationErrors('consent');
    T::comme($this, $this->compte)->postJson('/api/v1/tenant-invitations/acceptance', ['token' => $jeton])->assertUnprocessable();
    expect(fn () => app(TenantInvitations::class)->consume($this->compte->id, $jeton, false))
        ->toThrow(fn (ApiProblem $p): bool => $p->problemCode === 'tenant_invitation_consent_required');
    expect(($this->partieActuelle)()->user_id)->toBeNull();
});

it('refuse une seconde acceptation et un jeton inconnu ou expiré, sans les distinguer', function (): void {
    $jeton = ($this->inviter)();
    ($this->accepter)($jeton)->assertCreated();

    ($this->accepter)($jeton)->assertNotFound()->assertJsonPath('code', 'tenant_invitation_invalid');
    ($this->accepter)(str_repeat('a', 48))->assertNotFound()->assertJsonPath('code', 'tenant_invitation_invalid');

    $autre = T::partie($this->org);
    $jeton2 = ($this->inviter)($autre, ['email' => 'koffi@exemple.fr']);
    $this->travelTo(now()->addDays(7)->addSecond());
    ($this->accepter)($jeton2)->assertNotFound()->assertJsonPath('code', 'tenant_invitation_invalid');
});

it('annule l\'acceptation si le compte est déjà rattaché à un autre contact de l\'organisation', function (): void {
    T::partie($this->org, ['user_id' => $this->compte->id]);
    $jeton = ($this->inviter)();

    ($this->accepter)($jeton)->assertConflict()->assertJsonPath('code', 'tenant_account_already_linked');
    expect(($this->partieActuelle)()->user_id)->toBeNull()
        ->and(L::dans($this->org, fn (): string => TenantInvitation::query()->firstOrFail()->status->value))->toBe('pending');
});

it('remplace une invitation en attente : l\'ancien jeton cesse de valoir', function (): void {
    $ancien = ($this->inviter)();
    Notification::fake();
    $nouveau = ($this->inviter)();

    expect($nouveau)->not->toBe($ancien);
    ($this->accepter)($ancien)->assertNotFound();
    ($this->accepter)($nouveau)->assertCreated();
});

it('laisse l\'organisation révoquer une invitation en attente puis un rattachement accepté', function (): void {
    $jeton = ($this->inviter)();

    T::comme($this, $this->titulaire)->deleteJson(($this->urlAcces)())->assertNoContent();
    ($this->accepter)($jeton)->assertNotFound();
    T::comme($this, $this->titulaire)->getJson(($this->urlAcces)())->assertJsonPath('data.status', 'none');
    T::comme($this, $this->titulaire)->deleteJson(($this->urlAcces)())->assertNotFound()->assertJsonPath('code', 'tenant_access_not_found');

    Notification::fake();
    ($this->accepter)(($this->inviter)())->assertCreated();
    T::comme($this, $this->compte)->getJson('/api/v1/tenant/links')->assertOk();

    T::comme($this, $this->titulaire)->deleteJson(($this->urlAcces)())->assertNoContent();
    expect(($this->partieActuelle)()->user_id)->toBeNull();
    T::comme($this, $this->compte)->getJson('/api/v1/tenant/links')->assertForbidden()->assertJsonPath('code', 'space_forbidden');
    T::comme($this, $this->compte)->getJson('/api/v1/tenant/leases')->assertForbidden();
    expect(AuditLog::query()->pluck('action')->all())->toContain('parties.tenant_access.unlinked', 'identity.tenant_invitation.revoked');
});

it('laisse le titulaire du compte révoquer son propre rattachement, et lui seul', function (): void {
    ($this->accepter)(($this->inviter)())->assertCreated();
    $voisin = T::locataire($this->org);

    T::comme($this, $voisin['user'])->deleteJson("/api/v1/tenant/links/{$this->partie->id}")->assertNotFound()->assertJsonPath('code', 'tenant_access_not_found');
    expect(($this->partieActuelle)()->user_id)->toBe($this->compte->id);

    T::comme($this, $this->compte)->deleteJson("/api/v1/tenant/links/{$this->partie->id}")->assertNoContent();
    expect(($this->partieActuelle)()->user_id)->toBeNull();
    T::comme($this, $this->compte)->getJson('/api/v1/tenant/leases')->assertForbidden();
    T::comme($this, $this->titulaire)->getJson(($this->urlAcces)())->assertJsonPath('data.status', 'none');

    $revoque = L::dans($this->org, fn (): TenantInvitation => TenantInvitation::query()->firstOrFail());
    expect($revoque->revoked_by->value)->toBe('account')->and($revoque->revoked_by_user_id)->toBe($this->compte->id);

    Notification::fake();
    ($this->accepter)(($this->inviter)())->assertCreated();
});

it('retire le rattachement quand la partie est anonymisée', function (): void {
    ($this->accepter)(($this->inviter)())->assertCreated();

    T::comme($this, $this->titulaire)->postJson("/api/v1/org/{$this->org->id}/parties/{$this->partie->id}/anonymization")->assertSuccessful();

    expect(($this->partieActuelle)()->user_id)->toBeNull();
    T::comme($this, $this->compte)->getJson('/api/v1/tenant/leases')->assertForbidden();
    expect(L::dans($this->org, fn (): string => TenantInvitation::query()->firstOrFail()->revoked_by->value))->toBe('system');
});

it('protège les routes côté organisation : 401, rôle, autre organisation, contact inadapté', function (): void {
    $this->postJson(($this->urlAcces)())->assertUnauthorized();
    $this->getJson(($this->urlAcces)())->assertUnauthorized();
    $this->deleteJson(($this->urlAcces)())->assertUnauthorized();
    $this->postJson('/api/v1/tenant-invitations/acceptance', [])->assertUnauthorized();
    $this->postJson('/api/v1/tenant-invitations/preview', [])->assertUnauthorized();

    $comptable = L::membre($this->org, MemberRole::Accountant);
    T::comme($this, $comptable)->postJson(($this->urlAcces)())->assertForbidden()->assertJsonPath('code', 'role_forbidden');
    T::comme($this, $comptable)->getJson(($this->urlAcces)())->assertForbidden();

    $autreOrg = T::organisation('Immo Loire');
    $autreTitulaire = L::titulaire($autreOrg);
    $urlCroisee = "/api/v1/org/{$autreOrg->id}/parties/{$this->partie->id}/tenant-access";
    T::comme($this, $autreTitulaire)->postJson($urlCroisee)->assertNotFound()->assertJsonPath('code', 'party_not_found');
    T::comme($this, $autreTitulaire)->getJson($urlCroisee)->assertNotFound();
    T::comme($this, $autreTitulaire)->deleteJson($urlCroisee)->assertNotFound();
    T::comme($this, $this->titulaire)->postJson("/api/v1/org/{$autreOrg->id}/parties/{$this->partie->id}/tenant-access")->assertNotFound();

    $societe = L::dans($this->org, fn (): Party => Party::factory()->company()->create());
    T::comme($this, $this->titulaire)->postJson(($this->urlAcces)($societe), ['email' => 'contact@societe.fr'])->assertUnprocessable()->assertJsonPath('code', 'tenant_access_person_required');

    $sansEmail = T::partie($this->org);
    T::comme($this, $this->titulaire)->postJson(($this->urlAcces)($sansEmail))->assertUnprocessable()->assertJsonPath('code', 'tenant_access_email_required');

    $archivee = T::partie($this->org, ['archived_at' => now()]);
    T::comme($this, $this->titulaire)->postJson(($this->urlAcces)($archivee), ['email' => 'a@exemple.fr'])->assertConflict()->assertJsonPath('code', 'tenant_access_party_archived');

    $anonymisee = T::partie($this->org, ['anonymized_at' => now()]);
    T::comme($this, $this->titulaire)->postJson(($this->urlAcces)($anonymisee), ['email' => 'a@exemple.fr'])->assertConflict()->assertJsonPath('code', 'party_anonymized');

    T::comme($this, $this->titulaire)->postJson(($this->urlAcces)(), ['email' => 'pas-un-email'])->assertUnprocessable();
});

it('refuse d\'inviter une partie déjà rattachée', function (): void {
    ($this->accepter)(($this->inviter)())->assertCreated();

    T::comme($this, $this->titulaire)->postJson(($this->urlAcces)())->assertConflict()->assertJsonPath('code', 'party_already_linked');
});

it('refuse un jeton opérateur sur les routes du compte', function (): void {
    $operateur = User::factory()->create();
    $operateur->operator()->create(['granted_at' => now()])->roles()->create(['role' => 'admin', 'granted_at' => now()]);
    activerDeuxFacteurs($operateur);
    T::comme($this, null);

    $this->withToken($operateur->createToken('console', ['operator'])->plainTextToken)
        ->postJson('/api/v1/tenant-invitations/acceptance', ['token' => str_repeat('a', 48), 'consent' => true])
        ->assertForbidden()->assertJsonPath('code', 'operator_token_forbidden');
});
