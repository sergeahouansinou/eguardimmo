<?php

declare(strict_types=1);

use App\Modules\Identity\Models\User;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Password;

beforeEach(function (): void {
    Notification::fake();
});

it('déclare valide un jeton de réinitialisation émis pour cette adresse', function (): void {
    $user = User::factory()->create(['email' => 'jeanne@exemple.fr']);

    $this->postJson('/api/v1/auth/password-reset/status', ['token' => Password::createToken($user), 'email' => 'Jeanne@Exemple.fr'])
        ->assertOk()
        ->assertExactJson(['data' => ['status' => 'valid']]);
});

it('ne consomme pas le jeton : la réinitialisation fonctionne après la vérification', function (): void {
    $user = User::factory()->create(['email' => 'jeanne@exemple.fr']);
    $jeton = Password::createToken($user);

    $this->postJson('/api/v1/auth/password-reset/status', ['token' => $jeton, 'email' => 'jeanne@exemple.fr'])->assertOk();
    $this->postJson('/api/v1/auth/password-reset/status', ['token' => $jeton, 'email' => 'jeanne@exemple.fr'])
        ->assertJsonPath('data.status', 'valid');

    $this->postJson('/auth/reset-password', [
        'token' => $jeton,
        'email' => 'jeanne@exemple.fr',
        'password' => 'nouveau-mot-de-passe',
        'password_confirmation' => 'nouveau-mot-de-passe',
    ])->assertOk();

    $this->postJson('/api/v1/auth/password-reset/status', ['token' => $jeton, 'email' => 'jeanne@exemple.fr'])
        ->assertJsonPath('data.status', 'expired');
});

it('répond de la même façon pour un mauvais jeton, un compte inconnu et un jeton expiré', function (): void {
    $user = User::factory()->create(['email' => 'jeanne@exemple.fr']);
    $jeton = Password::createToken($user);

    $mauvais = $this->postJson('/api/v1/auth/password-reset/status', ['token' => 'faux', 'email' => 'jeanne@exemple.fr'])->assertOk();
    $inconnu = $this->postJson('/api/v1/auth/password-reset/status', ['token' => $jeton, 'email' => 'inconnu@exemple.fr'])->assertOk();

    $this->travel(61)->minutes();
    $expire = $this->postJson('/api/v1/auth/password-reset/status', ['token' => $jeton, 'email' => 'jeanne@exemple.fr'])->assertOk();

    expect(Arr::except($mauvais->json(), 'request_id'))->toBe(['data' => ['status' => 'expired']])
        ->and(Arr::except($inconnu->json(), 'request_id'))->toBe(Arr::except($mauvais->json(), 'request_id'))
        ->and(Arr::except($expire->json(), 'request_id'))->toBe(Arr::except($mauvais->json(), 'request_id'));
});

it('valide les champs en liste blanche', function (array $corps): void {
    $this->postJson('/api/v1/auth/password-reset/status', $corps)->assertUnprocessable();
})->with([
    'sans jeton' => [['email' => 'jeanne@exemple.fr']],
    'sans e-mail' => [['token' => 'abc']],
    'jeton non textuel' => [['token' => ['a'], 'email' => 'jeanne@exemple.fr']],
]);

it('limite la vérification par throttle:auth', function (): void {
    for ($i = 0; $i < 5; $i++) {
        $this->postJson('/api/v1/auth/password-reset/status', ['token' => 'faux', 'email' => 'jeanne@exemple.fr'])->assertOk();
    }

    $this->postJson('/api/v1/auth/password-reset/status', ['token' => 'faux', 'email' => 'jeanne@exemple.fr'])
        ->assertTooManyRequests()
        ->assertHeader('Retry-After');
});
