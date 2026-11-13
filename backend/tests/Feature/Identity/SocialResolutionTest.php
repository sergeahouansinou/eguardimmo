<?php

declare(strict_types=1);

use App\Modules\Identity\Actions\ResolveSocialLogin;
use App\Modules\Identity\Data\SocialIntent;
use App\Modules\Identity\Data\SocialProfileData;
use App\Modules\Identity\Enums\IntendedProfile;
use App\Modules\Identity\Enums\SocialProvider;
use App\Modules\Identity\Events\UserRegistered;
use App\Modules\Identity\Models\User;
use App\Shared\Audit\AuditLog;
use App\Shared\Http\ApiProblem;
use Illuminate\Support\Facades\Event;

function profilSocial(string $sujet = 'g-123', ?string $email = 'jean@exemple.fr', bool $verifie = true, ?string $nom = 'Jean Dupont', SocialProvider $fournisseur = SocialProvider::Google): SocialProfileData
{
    return new SocialProfileData($fournisseur, $sujet, $email, $verifie, $nom);
}

function resoudre(SocialProfileData $profil, SocialIntent $intention): User
{
    return app(ResolveSocialLogin::class)->handle($profil, $intention);
}

function codeRefus(Closure $appel): ?string
{
    try {
        $appel();
    } catch (ApiProblem $refus) {
        return $refus->problemCode;
    }

    return null;
}

it('connecte le titulaire d\'une identité déjà liée', function (): void {
    $user = User::factory()->create();
    $user->socialIdentities()->create(['provider' => SocialProvider::Google, 'subject' => 'g-123', 'email' => 'ancien@exemple.fr', 'email_verified' => true]);

    expect(resoudre(profilSocial(email: 'autre@exemple.fr'), SocialIntent::login())->is($user))->toBeTrue()
        ->and(AuditLog::query()->where('action', 'auth.social.login')->where('actor_user_id', $user->id)->exists())->toBeTrue();
});

it('refuse de lier une identité déjà rattachée à un autre compte', function (): void {
    $titulaire = User::factory()->create();
    $titulaire->socialIdentities()->create(['provider' => SocialProvider::Google, 'subject' => 'g-123']);
    $autre = User::factory()->create();

    expect(codeRefus(fn () => resoudre(profilSocial(), SocialIntent::link($autre->id))))->toBe('identity_already_linked');
});

it('rattache automatiquement si les deux e-mails sont vérifiés', function (): void {
    $user = User::factory()->create(['email' => 'jean@exemple.fr']);

    expect(resoudre(profilSocial(email: 'Jean@Exemple.fr'), SocialIntent::login())->is($user))->toBeTrue()
        ->and($user->socialIdentities()->where('subject', 'g-123')->exists())->toBeTrue()
        ->and(AuditLog::query()->where('action', 'auth.social.linked')->exists())->toBeTrue();
});

it('exige une liaison explicite si l\'e-mail local n\'est pas vérifié', function (): void {
    $user = User::factory()->unverified()->create(['email' => 'jean@exemple.fr']);

    expect(codeRefus(fn () => resoudre(profilSocial(), SocialIntent::login())))->toBe('account_exists_link_required')
        ->and($user->socialIdentities()->count())->toBe(0);
});

it('exige une liaison explicite si le fournisseur n\'atteste pas l\'e-mail', function (): void {
    User::factory()->create(['email' => 'jean@exemple.fr']);

    expect(codeRefus(fn () => resoudre(profilSocial(verifie: false), SocialIntent::register(IntendedProfile::Agency))))->toBe('account_exists_link_required');
});

it('ne rattache jamais par e-mail un relais privé Apple', function (): void {
    User::factory()->create(['email' => 'abc@privaterelay.appleid.com']);

    expect(codeRefus(fn () => resoudre(
        profilSocial('a-1', 'abc@privaterelay.appleid.com', true, null, SocialProvider::Apple),
        SocialIntent::login(),
    )))->toBe('account_exists_link_required');
});

it('crée le compte à l\'inscription, vérifié si le fournisseur l\'atteste', function (): void {
    Event::fake([UserRegistered::class]);

    $user = resoudre(profilSocial(email: 'Nouveau@Exemple.fr'), SocialIntent::register(IntendedProfile::IndividualLandlord));

    expect($user->email)->toBe('nouveau@exemple.fr')
        ->and($user->email_verified_at)->not->toBeNull()
        ->and($user->password)->toBeNull()
        ->and($user->name)->toBe('Jean Dupont');
    Event::assertDispatched(UserRegistered::class, fn (UserRegistered $e): bool => $e->userId === $user->id && $e->intendedProfile === IntendedProfile::IndividualLandlord);
});

it('crée un compte non vérifié si le fournisseur n\'atteste pas l\'e-mail', function (): void {
    $user = resoudre(profilSocial(verifie: false, nom: null), SocialIntent::register(IntendedProfile::Traveler));

    expect($user->email_verified_at)->toBeNull()
        ->and($user->name)->toBe('jean');
});

it('refuse la connexion sans compte existant', function (): void {
    expect(codeRefus(fn () => resoudre(profilSocial(), SocialIntent::login())))->toBe('no_account')
        ->and(User::query()->count())->toBe(0);
});

it('refuse l\'inscription sans e-mail', function (): void {
    expect(codeRefus(fn () => resoudre(profilSocial(email: null), SocialIntent::register(IntendedProfile::Agency))))->toBe('email_required');
});

it('refuse de lier un second compte du même fournisseur', function (): void {
    $user = User::factory()->create();
    $user->socialIdentities()->create(['provider' => SocialProvider::Google, 'subject' => 'g-ancien']);

    expect(codeRefus(fn () => resoudre(profilSocial('g-nouveau'), SocialIntent::link($user->id))))->toBe('provider_already_linked');
});

it('lie explicitement une identité au compte connecté, même avec un autre e-mail', function (): void {
    $user = User::factory()->create(['email' => 'jean@exemple.fr']);

    expect(resoudre(profilSocial(email: 'jean.perso@gmail.com', verifie: false), SocialIntent::link($user->id))->is($user))->toBeTrue()
        ->and($user->socialIdentities()->count())->toBe(1);
});

it('normalise email_verified', function (mixed $valeur, bool $attendu): void {
    expect(SocialProfileData::normalizeEmailVerified($valeur))->toBe($attendu);
})->with([
    [true, true],
    ['true', true],
    [false, false],
    ['false', false],
    ['1', false],
    [1, false],
    [null, false],
]);
