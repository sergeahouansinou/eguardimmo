<?php

declare(strict_types=1);

use App\Modules\Identity\Models\User;
use App\Modules\Organizations\Actions\CreateOrganization;
use App\Modules\Organizations\Data\NewOrganizationData;
use App\Modules\Organizations\Enums\MemberRole;
use App\Modules\Organizations\Enums\MemberStatus;
use App\Modules\Organizations\Enums\OrganizationKind;
use App\Modules\Organizations\Models\Organization;
use App\Modules\Organizations\Models\OrganizationMember;
use App\Modules\Organizations\Notifications\MemberInvitationNotification;
use App\Shared\Tenancy\CurrentOrganization;
use Illuminate\Notifications\AnonymousNotifiable;
use Illuminate\Support\Facades\Notification;

function organisation(?User $titulaire = null, OrganizationKind $type = OrganizationKind::Agency): Organization
{
    $titulaire ??= User::factory()->create();

    if ($type === OrganizationKind::Agency) {
        activerDeuxFacteurs($titulaire);
    }

    return app(CreateOrganization::class)->handle($titulaire, new NewOrganizationData($type, 'Agence du Port', 'FR'), 'Awa', 'Diallo');
}

function membre(Organization $organisation, MemberRole $role, ?User $compte = null, MemberStatus $statut = MemberStatus::Active): OrganizationMember
{
    $compte ??= User::factory()->create();

    if ($role->managesTeam()) {
        activerDeuxFacteurs($compte);
    }

    return app(CurrentOrganization::class)->run($organisation->id, fn (): OrganizationMember => OrganizationMember::query()->create([
        'user_id' => $compte->id,
        'email' => mb_strtolower($compte->email),
        'first_name' => 'Prénom',
        'last_name' => 'Nom',
        'role' => $role,
        'status' => $statut,
        'joined_at' => now(),
    ]));
}

function titulaire(Organization $organisation): User
{
    return User::query()->findOrFail($organisation->created_by_user_id);
}

function invitation(): array
{
    return [
        'email' => 'Fatou.Ndiaye@example.com',
        'first_name' => 'Fatou',
        'last_name' => 'Ndiaye',
        'role' => 'manager',
        'scope' => ['type' => 'all'],
        'message' => 'Bienvenue',
    ];
}

it('crée une organisation dont le créateur est titulaire', function (): void {
    $user = User::factory()->create();

    $reponse = $this->actingAs($user)->postJson('/api/v1/organizations', [
        'kind' => 'individual', 'name' => 'Mes biens', 'country' => 'FR', 'first_name' => 'Jean', 'last_name' => 'Martin',
    ])->assertCreated()->assertJsonPath('data.kind', 'individual');

    $id = $reponse->json('data.id');
    $this->getJson('/api/v1/me/profiles')
        ->assertOk()
        ->assertJsonFragment(['space' => 'organization', 'label' => 'Mes biens', 'meta' => ['organization' => $id, 'kind' => 'individual', 'role' => 'owner']]);
});

it('refuse de créer une organisation sans compte ou avec un pays hors registre', function (): void {
    $this->postJson('/api/v1/organizations', [])->assertUnauthorized();

    $this->actingAs(User::factory()->create())->postJson('/api/v1/organizations', [
        'kind' => 'agency', 'name' => 'X', 'country' => 'US', 'first_name' => 'A', 'last_name' => 'B', 'organization_id' => 'pirate',
    ])->assertUnprocessable()->assertJsonValidationErrors(['country', 'name']);
});

it('protège l\'espace organisation : 401, 404 hors membre, 404 sur identifiant invalide', function (): void {
    $org = organisation();

    $this->getJson("/api/v1/org/{$org->id}/members")->assertUnauthorized();

    $etranger = User::factory()->create();
    organisation($etranger);
    $this->actingAs($etranger)->getJson("/api/v1/org/{$org->id}/members")->assertNotFound()->assertJsonPath('code', 'organization_not_found');
    $this->actingAs($etranger)->getJson('/api/v1/org/pas-un-uuid/members')->assertNotFound();
});

it('ne révèle pas l\'organisation à un compte sans aucune organisation', function (): void {
    $org = organisation();

    $this->actingAs(User::factory()->create())->getJson("/api/v1/org/{$org->id}")->assertNotFound()->assertJsonPath('code', 'organization_not_found');
});

it('exige la double authentification des administrateurs d\'agence', function (): void {
    $org = organisation();
    $admin = User::factory()->create();
    membre($org, MemberRole::Admin, $admin);
    $admin->forceFill(['two_factor_confirmed_at' => null, 'two_factor_secret' => null])->save();

    $this->actingAs($admin)->getJson("/api/v1/org/{$org->id}")->assertForbidden()->assertJsonPath('code', 'two_factor_required');
});

it('exige la double authentification de tous quand l\'organisation l\'impose', function (): void {
    $org = organisation();
    $gestionnaire = User::factory()->create();
    membre($org, MemberRole::Manager, $gestionnaire);

    $this->actingAs($gestionnaire)->getJson("/api/v1/org/{$org->id}")->assertOk();

    $this->actingAs(titulaire($org))->putJson("/api/v1/org/{$org->id}/security", ['two_factor_required' => true])
        ->assertOk()->assertJsonPath('data.two_factor_required', true);

    auth()->forgetGuards();
    app()->forgetInstance(CurrentOrganization::class);
    $this->actingAs($gestionnaire)->getJson("/api/v1/org/{$org->id}")->assertForbidden()->assertJsonPath('code', 'two_factor_required');
});

it('liste l\'équipe de l\'organisation courante seulement', function (): void {
    $org = organisation();
    membre($org, MemberRole::Accountant);
    $autre = organisation();
    membre($autre, MemberRole::Manager);

    $this->actingAs(titulaire($org))->getJson("/api/v1/org/{$org->id}/members")
        ->assertOk()
        ->assertJsonCount(2, 'data')
        ->assertJsonPath('data.0.role', 'owner')
        ->assertJsonPath('data.0.self', true)
        ->assertJsonPath('data.0.two_factor', 'enabled')
        ->assertJsonPath('data.1.role', 'accountant')
        ->assertJsonPath('meta.two_factor_required', false);
});

it('invite un membre, envoie le lien et refuse le doublon', function (): void {
    Notification::fake();
    $org = organisation();

    $this->actingAs(titulaire($org))->postJson("/api/v1/org/{$org->id}/members", invitation())
        ->assertCreated()
        ->assertJsonPath('data.email', 'fatou.ndiaye@example.com')
        ->assertJsonPath('data.status', 'invited')
        ->assertJsonPath('data.two_factor', 'pending')
        ->assertJsonMissingPath('data.invitation_token_hash');

    Notification::assertSentTo(new AnonymousNotifiable, MemberInvitationNotification::class, function (MemberInvitationNotification $n, array $canaux, AnonymousNotifiable $dest): bool {
        return $dest->routes['mail'] === 'fatou.ndiaye@example.com' && str_starts_with($n->acceptUrl, 'https://auth.eguardimmo.test/invitation/');
    });

    $this->postJson("/api/v1/org/{$org->id}/members", invitation())->assertConflict()->assertJsonPath('code', 'already_member');
});

it('refuse d\'inviter un titulaire, ou depuis un rôle sans droit', function (): void {
    $org = organisation();
    $comptable = User::factory()->create();
    membre($org, MemberRole::Accountant, $comptable);

    $this->actingAs(titulaire($org))->postJson("/api/v1/org/{$org->id}/members", [...invitation(), 'role' => 'owner'])
        ->assertUnprocessable()->assertJsonValidationErrors('role');

    auth()->forgetGuards();
    app()->forgetInstance(CurrentOrganization::class);
    $this->actingAs($comptable)->postJson("/api/v1/org/{$org->id}/members", invitation())->assertForbidden()->assertJsonPath('code', 'role_forbidden');
});

it('refuse d\'inviter dans un compte de bailleur individuel', function (): void {
    $user = User::factory()->create();
    $org = organisation($user, OrganizationKind::Individual);

    $this->actingAs($user)->postJson("/api/v1/org/{$org->id}/members", invitation())->assertConflict()->assertJsonPath('code', 'single_member_organization');
});

it('fait accepter l\'invitation par le bon compte seulement, une seule fois', function (): void {
    Notification::fake();
    $org = organisation();
    $this->actingAs(titulaire($org))->postJson("/api/v1/org/{$org->id}/members", invitation())->assertCreated();

    $jeton = '';
    Notification::assertSentTo(new AnonymousNotifiable, MemberInvitationNotification::class, function (MemberInvitationNotification $n) use (&$jeton): bool {
        $jeton = basename($n->acceptUrl);

        return true;
    });

    auth()->forgetGuards();
    app()->forgetInstance(CurrentOrganization::class);
    $this->actingAs(User::factory()->create(['email' => 'autre@example.com']))
        ->postJson('/api/v1/invitations/acceptance', ['token' => $jeton])
        ->assertForbidden()->assertJsonPath('code', 'invitation_email_mismatch');

    $fatou = User::factory()->create(['email' => 'fatou.ndiaye@example.com']);
    $this->actingAs($fatou)->postJson('/api/v1/invitations/acceptance', ['token' => $jeton])
        ->assertOk()->assertJsonPath('data.organization_id', $org->id)->assertJsonPath('data.role', 'manager');

    $this->postJson('/api/v1/invitations/acceptance', ['token' => $jeton])->assertNotFound()->assertJsonPath('code', 'invitation_invalid');
    $this->getJson("/api/v1/org/{$org->id}")->assertOk()->assertJsonPath('data.name', 'Agence du Port');
});

it('refuse une invitation expirée', function (): void {
    Notification::fake();
    $org = organisation();
    $this->actingAs(titulaire($org))->postJson("/api/v1/org/{$org->id}/members", invitation())->assertCreated();
    $jeton = '';
    Notification::assertSentTo(new AnonymousNotifiable, MemberInvitationNotification::class, function (MemberInvitationNotification $n) use (&$jeton): bool {
        $jeton = basename($n->acceptUrl);

        return true;
    });

    $this->travel(8)->days();
    auth()->forgetGuards();
    $this->actingAs(User::factory()->create(['email' => 'fatou.ndiaye@example.com']))
        ->postJson('/api/v1/invitations/acceptance', ['token' => $jeton])->assertNotFound();
});

it('change le rôle et le périmètre d\'un membre', function (): void {
    $org = organisation();
    $cible = membre($org, MemberRole::Accountant);
    $bien = '01934f6e-0000-7000-8000-0000000000c1';

    $this->actingAs(titulaire($org))->patchJson("/api/v1/org/{$org->id}/members/{$cible->id}", [
        'role' => 'manager',
        'scope' => ['type' => 'selected', 'property_ids' => [$bien]],
    ])->assertOk()->assertJsonPath('data.role', 'manager')->assertJsonPath('data.scope', ['type' => 'selected', 'property_ids' => [$bien]]);
});

it('protège le titulaire, soi-même et le dernier administrateur', function (): void {
    $org = organisation();
    $proprio = app(CurrentOrganization::class)->run($org->id, fn () => OrganizationMember::query()->where('role', 'owner')->firstOrFail());

    $this->actingAs(titulaire($org))->patchJson("/api/v1/org/{$org->id}/members/{$proprio->id}", ['role' => 'admin'])
        ->assertConflict()->assertJsonPath('code', 'owner_immutable');
    $this->deleteJson("/api/v1/org/{$org->id}/members/{$proprio->id}")->assertConflict()->assertJsonPath('code', 'owner_immutable');

    $admin = User::factory()->create();
    $membreAdmin = membre($org, MemberRole::Admin, $admin);
    auth()->forgetGuards();
    app()->forgetInstance(CurrentOrganization::class);
    $this->actingAs($admin)->postJson("/api/v1/org/{$org->id}/members/{$membreAdmin->id}/deactivation")
        ->assertConflict()->assertJsonPath('code', 'self_change_forbidden');
});

it('désactive, réactive et retire un membre', function (): void {
    $org = organisation();
    $cible = membre($org, MemberRole::Manager);
    $this->actingAs(titulaire($org));

    $this->postJson("/api/v1/org/{$org->id}/members/{$cible->id}/deactivation")->assertOk()->assertJsonPath('data.status', 'disabled');
    $this->deleteJson("/api/v1/org/{$org->id}/members/{$cible->id}/deactivation")->assertOk()->assertJsonPath('data.status', 'active');
    $this->deleteJson("/api/v1/org/{$org->id}/members/{$cible->id}/deactivation")->assertConflict()->assertJsonPath('code', 'not_disabled');
    $this->deleteJson("/api/v1/org/{$org->id}/members/{$cible->id}")->assertNoContent();

    $this->getJson("/api/v1/org/{$org->id}/members")->assertJsonCount(1, 'data');
    $this->assertSoftDeleted('organization_members', ['id' => $cible->id]);
});

it('renvoie 404 sur le membre d\'une autre organisation', function (): void {
    $org = organisation();
    $autre = organisation();
    $etranger = membre($autre, MemberRole::Manager);

    $this->actingAs(titulaire($org))->patchJson("/api/v1/org/{$org->id}/members/{$etranger->id}", ['role' => 'accountant'])
        ->assertNotFound()->assertJsonPath('code', 'member_not_found');
    $this->deleteJson("/api/v1/org/{$org->id}/members/{$etranger->id}")->assertNotFound();
});

it('renvoie et annule une invitation', function (): void {
    Notification::fake();
    $org = organisation();
    $this->actingAs(titulaire($org));
    $id = $this->postJson("/api/v1/org/{$org->id}/members", invitation())->json('data.id');

    $this->postJson("/api/v1/org/{$org->id}/members/{$id}/invitation")->assertOk();
    Notification::assertSentTimes(MemberInvitationNotification::class, 2);

    $this->deleteJson("/api/v1/org/{$org->id}/members/{$id}")->assertNoContent();
    $this->postJson("/api/v1/org/{$org->id}/members", invitation())->assertCreated()->assertJsonPath('data.id', $id);
});
