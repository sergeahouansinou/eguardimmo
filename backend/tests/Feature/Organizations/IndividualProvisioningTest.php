<?php

declare(strict_types=1);

use App\Modules\Identity\Enums\IntendedProfile;
use App\Modules\Identity\Models\User;
use App\Modules\Identity\Notifications\VerifyEmailNotification;
use App\Modules\Organizations\Enums\MemberRole;
use App\Modules\Organizations\Enums\MemberStatus;
use App\Modules\Organizations\Enums\OrganizationKind;
use App\Modules\Organizations\Models\Organization;
use App\Modules\Organizations\Models\OrganizationMember;
use App\Shared\Audit\AuditLog;
use App\Shared\Tenancy\CurrentOrganization;
use Illuminate\Auth\Events\Verified;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\URL;

function inscrireEtVerifier(IntendedProfile $profil, string $nom = 'Jeanne Martin'): User
{
    Notification::fake();

    test()->postJson('/auth/register', [
        'name' => $nom,
        'email' => 'jeanne@exemple.fr',
        'password' => 'motdepasse-solide',
        'password_confirmation' => 'motdepasse-solide',
        'intended_profile' => $profil->value,
    ])->assertStatus(202);

    $user = User::query()->where('email', 'jeanne@exemple.fr')->sole();
    $jeton = null;

    Notification::assertSentTo($user, VerifyEmailNotification::class, function (VerifyEmailNotification $n) use ($user, &$jeton): bool {
        parse_str((string) parse_url((string) $n->toMail($user)->actionUrl, PHP_URL_QUERY), $requete);
        $jeton = $requete['jeton'];

        return true;
    });

    test()->postJson((string) $jeton)->assertOk();

    return $user->refresh();
}

function organisationsIndividuelles(User $user): int
{
    return Organization::query()->where('kind', OrganizationKind::Individual)->where('created_by_user_id', $user->id)->count();
}

it('crée l\'organisation individual du bailleur autonome à la vérification de son e-mail', function (): void {
    $user = inscrireEtVerifier(IntendedProfile::IndividualLandlord);

    $organisation = Organization::query()->sole();

    expect($organisation->kind)->toBe(OrganizationKind::Individual)
        ->and($organisation->name)->toBe('Jeanne Martin')
        ->and($organisation->country)->toBe('FR')
        ->and($organisation->created_by_user_id)->toBe($user->id);

    $membre = app(CurrentOrganization::class)->run($organisation->id, fn (): OrganizationMember => OrganizationMember::query()->sole());

    expect($membre->user_id)->toBe($user->id)
        ->and($membre->role)->toBe(MemberRole::Owner)
        ->and($membre->status)->toBe(MemberStatus::Active)
        ->and($membre->first_name)->toBe('Jeanne')
        ->and($membre->last_name)->toBe('Martin');

    $this->withToken($user->createToken('t', ['mobile'])->plainTextToken)
        ->getJson('/api/v1/me/profiles')
        ->assertOk()
        ->assertJsonPath('data.0.space', 'organization')
        ->assertJsonPath('data.0.label', 'Jeanne Martin')
        ->assertJsonPath('data.0.meta.organization', $organisation->id)
        ->assertJsonPath('data.0.meta.kind', 'individual')
        ->assertJsonPath('data.0.meta.role', 'owner');
});

it('audite la création sans e-mail dans le journal', function (): void {
    $user = inscrireEtVerifier(IntendedProfile::IndividualLandlord);

    $entree = AuditLog::query()->where('action', 'organizations.individual.provisioned')->sole();

    expect($entree->actor_user_id)->toBe($user->id)
        ->and($entree->subject_id)->toBe(Organization::query()->sole()->id)
        ->and(json_encode($entree->metadata))->not->toContain('exemple.fr');
});

it('ne crée aucune organisation pour une autre intention', function (IntendedProfile $profil): void {
    inscrireEtVerifier($profil);

    expect(Organization::query()->count())->toBe(0);
})->with([IntendedProfile::Agency, IntendedProfile::Traveler]);

it('ne crée rien rétroactivement pour un compte sans intention enregistrée', function (): void {
    $user = User::factory()->unverified()->create();

    event(new Verified($user));

    expect(Organization::query()->count())->toBe(0);
});

it('reste idempotent quand l\'événement est rejoué', function (): void {
    $user = inscrireEtVerifier(IntendedProfile::IndividualLandlord);

    event(new Verified($user));
    event(new Verified($user));

    expect(organisationsIndividuelles($user))->toBe(1)
        ->and(OrganizationMember::withoutGlobalScopes()->where('user_id', $user->id)->count())->toBe(1)
        ->and(AuditLog::query()->where('action', 'organizations.individual.provisioned')->count())->toBe(1);
});

it('crée aussi l\'organisation par la route Fortify authentifiée', function (): void {
    $user = User::factory()->unverified()->create(['intended_profile' => IntendedProfile::IndividualLandlord]);
    $lien = URL::temporarySignedRoute('verification.verify', now()->addMinutes(60), ['id' => $user->id, 'hash' => sha1($user->email)]);

    $this->actingAs($user, 'web')->get($lien)->assertRedirect();

    expect(organisationsIndividuelles($user))->toBe(1);
});

it('annule la vérification si la création de l\'organisation échoue', function (): void {
    $user = User::factory()->unverified()->create(['intended_profile' => IntendedProfile::IndividualLandlord, 'name' => 'Jeanne Martin']);
    $lien = URL::temporarySignedRoute('identity.email.verify', now()->addMinutes(60), ['id' => $user->id, 'hash' => sha1($user->email)]);
    Organization::creating(fn () => throw new RuntimeException('panne'));

    $this->postJson($lien)->assertStatus(500);

    expect($user->refresh()->hasVerifiedEmail())->toBeFalse()
        ->and(Organization::query()->count())->toBe(0);
});

it('découpe le nom du compte en prénom et nom du titulaire', function (): void {
    $user = inscrireEtVerifier(IntendedProfile::IndividualLandlord, 'Jean Pierre de La Fontaine');

    $membre = app(CurrentOrganization::class)->run(
        Organization::query()->where('created_by_user_id', $user->id)->sole()->id,
        fn (): OrganizationMember => OrganizationMember::query()->sole(),
    );

    expect([$membre->first_name, $membre->last_name])->toBe(['Jean', 'Pierre de La Fontaine']);
});
