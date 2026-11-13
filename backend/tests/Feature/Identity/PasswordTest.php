<?php

declare(strict_types=1);

use App\Modules\Identity\Fortify\PasswordResetLinkRequestedResponse;
use App\Modules\Identity\Models\User;
use App\Modules\Identity\Notifications\PasswordChangedNotification;
use App\Modules\Identity\Notifications\ResetPasswordNotification;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Password;

beforeEach(function (): void {
    Notification::fake();
});

it('répond 202 identique que le compte existe ou non', function (): void {
    $user = User::factory()->create(['email' => 'jeanne@exemple.fr']);

    $existant = $this->postJson('/auth/forgot-password', ['email' => 'jeanne@exemple.fr'])->assertStatus(202);
    $inconnu = $this->postJson('/auth/forgot-password', ['email' => 'inconnu@exemple.fr'])->assertStatus(202);

    expect($existant->json())->toBe($inconnu->json())
        ->and($existant->json('message'))->toBe(PasswordResetLinkRequestedResponse::MESSAGE);
    Notification::assertSentTo($user, ResetPasswordNotification::class);
    Notification::assertCount(1);
});

it('répond 202 identique quand le lien vient d\'être envoyé', function (): void {
    User::factory()->create(['email' => 'jeanne@exemple.fr']);

    $this->postJson('/auth/forgot-password', ['email' => 'jeanne@exemple.fr'])->assertStatus(202);
    $this->postJson('/auth/forgot-password', ['email' => 'jeanne@exemple.fr'])
        ->assertStatus(202)
        ->assertExactJson(['message' => PasswordResetLinkRequestedResponse::MESSAGE]);
});

it('envoie un lien vers le hub, pas vers l\'API', function (): void {
    $user = User::factory()->create(['email' => 'jeanne@exemple.fr']);

    $this->postJson('/auth/forgot-password', ['email' => 'jeanne@exemple.fr']);

    Notification::assertSentTo($user, ResetPasswordNotification::class, function (ResetPasswordNotification $n) use ($user): bool {
        $url = $n->toMail($user)->actionUrl;

        return str_starts_with($url, 'https://auth.eguardimmo.test/reinitialiser?token=');
    });
});

it('réinitialise le mot de passe, révoque jetons et sessions et prévient le titulaire', function (): void {
    $user = User::factory()->create(['email' => 'jeanne@exemple.fr']);
    $jeton = $user->createToken('mobile', ['mobile'])->plainTextToken;
    DB::table('sessions')->insert(['id' => 'session-ancienne', 'user_id' => $user->id, 'payload' => '', 'last_activity' => time()]);
    $ancienRemember = $user->getRememberToken();

    $this->withToken($jeton)->getJson('/api/v1/me')->assertOk();
    auth()->forgetGuards();
    auth()->shouldUse('web');

    $this->postJson('/auth/reset-password', [
        'token' => Password::createToken($user),
        'email' => 'jeanne@exemple.fr',
        'password' => 'nouveau-mot-de-passe',
        'password_confirmation' => 'nouveau-mot-de-passe',
    ])->assertOk();

    $this->withToken($jeton)->getJson('/api/v1/me')->assertUnauthorized();
    expect(DB::table('sessions')->where('user_id', $user->id)->count())->toBe(0)
        ->and($user->refresh()->getRememberToken())->not->toBe($ancienRemember)
        ->and(Hash::check('nouveau-mot-de-passe', (string) $user->password))->toBeTrue();
    Notification::assertSentTo($user, PasswordChangedNotification::class);
});

it('permet à un compte sans mot de passe d\'en définir un par « mot de passe oublié »', function (): void {
    $user = User::factory()->create(['email' => 'social@exemple.fr', 'password' => null]);

    $this->postJson('/auth/forgot-password', ['email' => 'social@exemple.fr'])->assertStatus(202);
    Notification::assertSentTo($user, ResetPasswordNotification::class);

    $this->postJson('/auth/reset-password', [
        'token' => Password::createToken($user),
        'email' => 'social@exemple.fr',
        'password' => 'nouveau-mot-de-passe',
        'password_confirmation' => 'nouveau-mot-de-passe',
    ])->assertOk();

    expect($user->refresh()->password)->not->toBeNull();
});

it('refuse un jeton de réinitialisation invalide', function (): void {
    User::factory()->create(['email' => 'jeanne@exemple.fr']);

    $this->postJson('/auth/reset-password', [
        'token' => 'faux',
        'email' => 'jeanne@exemple.fr',
        'password' => 'nouveau-mot-de-passe',
        'password_confirmation' => 'nouveau-mot-de-passe',
    ])->assertUnprocessable();
});

it('change le mot de passe en gardant la session courante et en révoquant le reste', function (): void {
    $user = User::factory()->create();
    $jeton = $user->createToken('mobile', ['mobile'])->plainTextToken;

    $this->actingAs($user, 'web')->putJson('/auth/user/password', [
        'current_password' => 'password',
        'password' => 'nouveau-mot-de-passe',
        'password_confirmation' => 'nouveau-mot-de-passe',
    ])->assertOk();

    auth()->forgetGuards();
    $this->withToken($jeton)->getJson('/api/v1/me')->assertUnauthorized();
    Notification::assertSentTo($user, PasswordChangedNotification::class);
});

it('refuse le changement sans le mot de passe actuel', function (): void {
    $user = User::factory()->create();

    $this->actingAs($user, 'web')->putJson('/auth/user/password', [
        'current_password' => 'faux',
        'password' => 'nouveau-mot-de-passe',
        'password_confirmation' => 'nouveau-mot-de-passe',
    ])->assertUnprocessable();

    expect(Hash::check('password', (string) $user->refresh()->password))->toBeTrue();
});

it('refuse le changement de mot de passe sans session', function (): void {
    $this->putJson('/auth/user/password', ['password' => 'x'])->assertUnauthorized();
});
