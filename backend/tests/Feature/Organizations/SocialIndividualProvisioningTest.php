<?php

declare(strict_types=1);

use App\Modules\Identity\Actions\ResolveSocialLogin;
use App\Modules\Identity\Data\SocialIntent;
use App\Modules\Identity\Data\SocialProfileData;
use App\Modules\Identity\Enums\IntendedProfile;
use App\Modules\Identity\Enums\SocialProvider;
use App\Modules\Identity\Events\UserRegistered;
use App\Modules\Identity\Models\User;
use App\Modules\Organizations\Enums\MemberRole;
use App\Modules\Organizations\Enums\OrganizationKind;
use App\Modules\Organizations\Models\Organization;
use App\Modules\Organizations\Models\OrganizationMember;
use App\Shared\Audit\AuditLog;
use App\Shared\Tenancy\CurrentOrganization;

function inscrireParFournisseur(IntendedProfile $profil, SocialProvider $fournisseur = SocialProvider::Google, bool $verifie = true, string $sujet = 'sujet-1'): User
{
    return app(ResolveSocialLogin::class)->handle(
        new SocialProfileData($fournisseur, $sujet, 'jeanne@exemple.fr', $verifie, 'Jeanne Martin'),
        SocialIntent::register($profil),
    );
}

it('crée l\'organisation individual à l\'inscription Google ou Apple d\'un bailleur autonome', function (SocialProvider $fournisseur): void {
    $user = inscrireParFournisseur(IntendedProfile::IndividualLandlord, $fournisseur);

    $organisation = Organization::query()->sole();
    $membre = app(CurrentOrganization::class)->run($organisation->id, fn (): OrganizationMember => OrganizationMember::query()->sole());

    expect($organisation->kind)->toBe(OrganizationKind::Individual)
        ->and($organisation->name)->toBe('Jeanne Martin')
        ->and($organisation->created_by_user_id)->toBe($user->id)
        ->and($membre->user_id)->toBe($user->id)
        ->and($membre->role)->toBe(MemberRole::Owner)
        ->and($membre->first_name)->toBe('Jeanne')
        ->and($membre->last_name)->toBe('Martin');

    $entree = AuditLog::query()->where('action', 'organizations.individual.provisioned')->sole();

    expect($entree->metadata)->toMatchArray(['trigger' => 'social_registration'])
        ->and(json_encode($entree->metadata))->not->toContain('exemple.fr');
})->with([SocialProvider::Google, SocialProvider::Apple]);

it('ne crée aucune organisation pour une autre intention', function (IntendedProfile $profil): void {
    inscrireParFournisseur($profil);

    expect(Organization::query()->count())->toBe(0);
})->with([IntendedProfile::Agency, IntendedProfile::Traveler]);

it('ne crée rien tant que le fournisseur n\'atteste pas l\'e-mail', function (): void {
    $user = inscrireParFournisseur(IntendedProfile::IndividualLandlord, verifie: false);

    expect($user->email_verified_at)->toBeNull()
        ->and(Organization::query()->count())->toBe(0);
});

it('ne crée rien à la simple connexion d\'un compte social existant', function (): void {
    $user = User::factory()->create(['email' => 'jeanne@exemple.fr', 'intended_profile' => IntendedProfile::IndividualLandlord]);
    $user->socialIdentities()->create(['provider' => SocialProvider::Google, 'subject' => 'sujet-1', 'email' => 'jeanne@exemple.fr', 'email_verified' => true]);

    $connecte = app(ResolveSocialLogin::class)->handle(
        new SocialProfileData(SocialProvider::Google, 'sujet-1', 'jeanne@exemple.fr', true, 'Jeanne Martin'),
        SocialIntent::login(),
    );

    expect($connecte->is($user))->toBeTrue()
        ->and(Organization::query()->count())->toBe(0);
});

it('ne crée rien au rattachement d\'un fournisseur à un compte existant d\'intention bailleur', function (): void {
    $user = User::factory()->create(['email' => 'jeanne@exemple.fr', 'intended_profile' => IntendedProfile::IndividualLandlord]);

    app(ResolveSocialLogin::class)->handle(
        new SocialProfileData(SocialProvider::Google, 'sujet-1', 'jeanne@exemple.fr', true, 'Jeanne Martin'),
        SocialIntent::login(),
    );

    expect($user->socialIdentities()->count())->toBe(1)
        ->and(Organization::query()->count())->toBe(0);
});

it('reste idempotent quand l\'événement d\'inscription est rejoué', function (): void {
    $user = inscrireParFournisseur(IntendedProfile::IndividualLandlord);

    event(new UserRegistered($user->id, IntendedProfile::IndividualLandlord));
    event(new UserRegistered($user->id, IntendedProfile::IndividualLandlord));

    expect(Organization::query()->where('created_by_user_id', $user->id)->count())->toBe(1)
        ->and(OrganizationMember::withoutGlobalScopes()->where('user_id', $user->id)->count())->toBe(1)
        ->and(AuditLog::query()->where('action', 'organizations.individual.provisioned')->count())->toBe(1);
});

it('ne crée rien pour une inscription par e-mail, avant la vérification de l\'adresse', function (): void {
    $this->postJson('/auth/register', [
        'name' => 'Jeanne Martin',
        'email' => 'jeanne@exemple.fr',
        'password' => 'motdepasse-solide',
        'password_confirmation' => 'motdepasse-solide',
        'intended_profile' => 'individual_landlord',
    ])->assertStatus(202);

    expect(Organization::query()->count())->toBe(0);
});
