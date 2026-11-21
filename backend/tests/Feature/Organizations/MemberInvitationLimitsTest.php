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
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Notification;
use Illuminate\Testing\TestResponse;

function agenceAvecTitulaire(): array
{
    $titulaire = User::factory()->create();
    activerDeuxFacteurs($titulaire);
    $org = app(CreateOrganization::class)->handle($titulaire, new NewOrganizationData(OrganizationKind::Agency, 'Agence du Port', 'FR'), 'Awa', 'Diallo');

    return [$org, $titulaire];
}

/**
 * @return array<string, mixed>
 */
function corpsInvitation(string $email): array
{
    return ['email' => $email, 'first_name' => 'Fatou', 'last_name' => 'Ndiaye', 'role' => 'manager', 'scope' => ['type' => 'all']];
}

function inviterMembre(object $test, Organization $org, string $email): TestResponse
{
    return $test->postJson("/api/v1/org/{$org->id}/members", corpsInvitation($email));
}

function renvoyerInvitation(object $test, Organization $org, string $membreId): TestResponse
{
    return $test->postJson("/api/v1/org/{$org->id}/members/{$membreId}/invitation");
}

beforeEach(function (): void {
    Notification::fake();
    $this->travelTo(CarbonImmutable::parse('2026-11-21 09:00:00'));
    [$this->org, $this->titulaire] = agenceAvecTitulaire();
    $this->actingAs($this->titulaire);
});

it('laisse inviter puis renvoyer une invitation dans les plafonds par défaut', function (): void {
    $id = inviterMembre($this, $this->org, 'fatou@example.com')->assertCreated()->json('data.id');

    $this->travel(61)->seconds();
    renvoyerInvitation($this, $this->org, $id)->assertOk();
    Notification::assertSentTimes(MemberInvitationNotification::class, 2);
});

it('refuse un renvoi trop rapproché avec Retry-After', function (): void {
    $id = inviterMembre($this, $this->org, 'fatou@example.com')->assertCreated()->json('data.id');
    renvoyerInvitation($this, $this->org, $id)->assertOk();

    renvoyerInvitation($this, $this->org, $id)
        ->assertStatus(429)
        ->assertHeader('Retry-After')
        ->assertJsonPath('code', 'member_invitation_resend_too_soon')
        ->assertJsonPath('status', 429);
    Notification::assertSentTimes(MemberInvitationNotification::class, 2);

    $this->travel(61)->seconds();
    renvoyerInvitation($this, $this->org, $id)->assertOk();
});

it('plafonne les renvois d\'une invitation par vingt-quatre heures', function (): void {
    config(['organizations.invitations.resend_daily_max' => 2, 'organizations.invitations.resend_delay_seconds' => 1]);
    $id = inviterMembre($this, $this->org, 'fatou@example.com')->assertCreated()->json('data.id');

    foreach ([1, 2] as $_) {
        $this->travel(2)->seconds();
        renvoyerInvitation($this, $this->org, $id)->assertOk();
    }

    $this->travel(2)->seconds();
    $refus = renvoyerInvitation($this, $this->org, $id)->assertStatus(429)->assertJsonPath('code', 'member_invitation_resend_limit_reached');
    expect((int) $refus->headers->get('Retry-After'))->toBeGreaterThan(3600);
    Notification::assertSentTimes(MemberInvitationNotification::class, 3);

    $this->travel(25)->hours();
    renvoyerInvitation($this, $this->org, $id)->assertOk();
});

it('plafonne les invitations à une même adresse', function (): void {
    config(['organizations.invitations.address_daily_max' => 2]);

    foreach ([1, 2] as $_) {
        $id = inviterMembre($this, $this->org, 'Fatou@example.com')->assertCreated()->json('data.id');
        $this->deleteJson("/api/v1/org/{$this->org->id}/members/{$id}")->assertNoContent();
    }

    inviterMembre($this, $this->org, 'fatou@example.com')->assertStatus(429)->assertHeader('Retry-After')->assertJsonPath('code', 'member_invitation_address_limit_reached');
    inviterMembre($this, $this->org, 'autre@example.com')->assertCreated();
});

it('plafonne par heure les e-mails d\'invitation d\'une organisation, invitations et renvois confondus', function (): void {
    config(['organizations.invitations.organization_hourly_max' => 2, 'organizations.invitations.resend_delay_seconds' => 1]);
    $id = inviterMembre($this, $this->org, 'a@example.com')->assertCreated()->json('data.id');
    $this->travel(2)->seconds();
    renvoyerInvitation($this, $this->org, $id)->assertOk();

    inviterMembre($this, $this->org, 'b@example.com')->assertStatus(429)->assertHeader('Retry-After')->assertJsonPath('code', 'member_invitation_rate_limited');

    $this->travel(61)->minutes();
    inviterMembre($this, $this->org, 'b@example.com')->assertCreated();
});

it('plafonne par jour les e-mails d\'invitation d\'une organisation', function (): void {
    config(['organizations.invitations.organization_daily_max' => 2]);
    inviterMembre($this, $this->org, 'a@example.com')->assertCreated();
    inviterMembre($this, $this->org, 'b@example.com')->assertCreated();

    inviterMembre($this, $this->org, 'c@example.com')->assertStatus(429)->assertHeader('Retry-After')->assertJsonPath('code', 'member_invitation_daily_limit_reached');
    expect(app(CurrentOrganization::class)->run($this->org->id, fn (): int => OrganizationMember::query()->where('status', MemberStatus::Invited)->count()))->toBe(2);

    $this->travel(25)->hours();
    inviterMembre($this, $this->org, 'c@example.com')->assertCreated();
});

it('ne mélange pas les compteurs de deux organisations', function (): void {
    config(['organizations.invitations.organization_daily_max' => 1]);
    inviterMembre($this, $this->org, 'a@example.com')->assertCreated();
    inviterMembre($this, $this->org, 'b@example.com')->assertStatus(429);

    [$autre, $titulaireAutre] = agenceAvecTitulaire();
    app()->forgetInstance(CurrentOrganization::class);
    app()->forgetScopedInstances();
    $this->actingAs($titulaireAutre);
    inviterMembre($this, $autre, 'a@example.com')->assertCreated();
});

it('ne laisse pas un membre sans droit consommer le quota de l\'organisation', function (): void {
    config(['organizations.invitations.organization_daily_max' => 1]);
    $comptable = User::factory()->create();
    app(CurrentOrganization::class)->run($this->org->id, fn (): OrganizationMember => OrganizationMember::query()->create([
        'user_id' => $comptable->id, 'email' => mb_strtolower($comptable->email), 'first_name' => 'Jean', 'last_name' => 'Comptable',
        'role' => MemberRole::Accountant, 'status' => MemberStatus::Active, 'joined_at' => now(),
    ]));

    $this->actingAs($comptable);
    foreach (range(1, 3) as $i) {
        inviterMembre($this, $this->org, "x{$i}@example.com")->assertForbidden()->assertJsonPath('code', 'role_forbidden');
    }

    $this->actingAs($this->titulaire);
    inviterMembre($this, $this->org, 'a@example.com')->assertCreated();
});
