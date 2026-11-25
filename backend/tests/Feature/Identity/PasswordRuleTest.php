<?php

declare(strict_types=1);

use App\Modules\Identity\Models\User;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Password;
use Tests\Feature\Console\ConsoleContext;

const TROP_COURT = 'Le champ mot de passe doit contenir au moins 6 caractères.';

dataset('mots de passe sans composition', [
    'chiffres connus des fuites' => '123456',
    'minuscules' => 'azerty',
    'majuscules' => 'AZERTY',
    'symboles' => '!?-_*#',
    'accents' => 'éàçùîô',
    'espaces intérieurs' => 'a    b',
]);

beforeEach(function (): void {
    Notification::fake();
    Http::preventStrayRequests();
});

it('accepte à l\'inscription tout mot de passe de 6 caractères, sans contrôle de fuite', function (string $motDePasse): void {
    $this->postJson('/auth/register', [
        'name' => 'Jeanne Martin',
        'email' => 'jeanne@exemple.fr',
        'password' => $motDePasse,
        'password_confirmation' => $motDePasse,
        'intended_profile' => 'agency',
    ])->assertStatus(202);

    expect(Hash::check($motDePasse, (string) User::query()->sole()->password))->toBeTrue();
    Http::assertNothingSent();
})->with('mots de passe sans composition');

it('refuse 5 caractères à l\'inscription', function (): void {
    $this->postJson('/auth/register', [
        'name' => 'Jeanne Martin',
        'email' => 'jeanne@exemple.fr',
        'password' => '12345',
        'password_confirmation' => '12345',
        'intended_profile' => 'agency',
    ])->assertUnprocessable()->assertJsonPath('errors.password.0', TROP_COURT);

    expect(User::query()->count())->toBe(0);
});

it('accepte 6 caractères à la réinitialisation', function (): void {
    $user = User::factory()->create(['email' => 'jeanne@exemple.fr']);

    $this->postJson('/auth/reset-password', [
        'token' => Password::createToken($user),
        'email' => 'jeanne@exemple.fr',
        'password' => 'azerty',
        'password_confirmation' => 'azerty',
    ])->assertOk();

    expect(Hash::check('azerty', (string) $user->refresh()->password))->toBeTrue();
});

it('refuse 5 caractères à la réinitialisation', function (): void {
    $user = User::factory()->create(['email' => 'jeanne@exemple.fr']);

    $this->postJson('/auth/reset-password', [
        'token' => Password::createToken($user),
        'email' => 'jeanne@exemple.fr',
        'password' => 'azert',
        'password_confirmation' => 'azert',
    ])->assertUnprocessable()->assertJsonPath('errors.password.0', TROP_COURT);

    expect(Hash::check('password', (string) $user->refresh()->password))->toBeTrue();
});

it('accepte 6 caractères au changement', function (): void {
    $user = User::factory()->create();

    $this->actingAs($user, 'web')->putJson('/auth/user/password', [
        'current_password' => 'password',
        'password' => 'azerty',
        'password_confirmation' => 'azerty',
    ])->assertOk();

    expect(Hash::check('azerty', (string) $user->refresh()->password))->toBeTrue();
});

it('refuse 5 caractères au changement', function (): void {
    $user = User::factory()->create();

    $this->actingAs($user, 'web')->putJson('/auth/user/password', [
        'current_password' => 'password',
        'password' => 'azert',
        'password_confirmation' => 'azert',
    ])->assertUnprocessable()->assertJsonPath('errors.password.0', TROP_COURT);

    expect(Hash::check('password', (string) $user->refresh()->password))->toBeTrue();
});

it('applique la même règle à un opérateur au changement : 6 acceptés', function (): void {
    $op = ConsoleContext::operateur(['admin'], 'Opératrice', true, 'operatrice@exemple.fr');

    $this->actingAs($op['user'], 'web')->putJson('/auth/user/password', [
        'current_password' => 'password',
        'password' => 'azerty',
        'password_confirmation' => 'azerty',
    ])->assertOk();

    expect(Hash::check('azerty', (string) $op['user']->refresh()->password))->toBeTrue();
    Http::assertNothingSent();
});

it('applique la même règle à un opérateur à la réinitialisation : 6 acceptés, sans toucher à sa 2FA', function (): void {
    $op = ConsoleContext::operateur(['admin'], 'Opératrice', true, 'operatrice@exemple.fr');

    $this->postJson('/auth/reset-password', [
        'token' => Password::createToken($op['user']),
        'email' => 'operatrice@exemple.fr',
        'password' => 'azerty',
        'password_confirmation' => 'azerty',
    ])->assertOk();

    expect(Hash::check('azerty', (string) $op['user']->refresh()->password))->toBeTrue()
        ->and($op['user']->hasConfirmedTwoFactor())->toBeTrue();
});

it('refuse 5 caractères à un opérateur au changement et à la réinitialisation', function (): void {
    $op = ConsoleContext::operateur(['admin'], 'Opératrice', true, 'operatrice@exemple.fr');

    $this->actingAs($op['user'], 'web')->putJson('/auth/user/password', [
        'current_password' => 'password',
        'password' => 'azert',
        'password_confirmation' => 'azert',
    ])->assertUnprocessable()->assertJsonPath('errors.password.0', TROP_COURT);

    auth()->forgetGuards();
    auth()->shouldUse('web');

    $this->postJson('/auth/reset-password', [
        'token' => Password::createToken($op['user']),
        'email' => 'operatrice@exemple.fr',
        'password' => 'azert',
        'password_confirmation' => 'azert',
    ])->assertUnprocessable()->assertJsonPath('errors.password.0', TROP_COURT);

    expect(Hash::check('password', (string) $op['user']->refresh()->password))->toBeTrue();
});
