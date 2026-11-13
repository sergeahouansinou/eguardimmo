<?php

declare(strict_types=1);

use App\Modules\Identity\Models\PersonalAccessToken;
use App\Modules\Identity\Models\User;
use App\Modules\Identity\Notifications\NewDeviceLoginNotification;
use App\Modules\Identity\Security\TwoFactorChallenges;
use Illuminate\Support\Facades\Notification;

beforeEach(function (): void {
    Notification::fake();
});

function connexionMobile(array $surcharges = []): array
{
    return array_merge(['email' => 'jeanne@exemple.fr', 'password' => 'password', 'device_name' => 'iPhone de Jeanne'], $surcharges);
}

it('délivre un jeton mobile à capacité mobile seulement', function (): void {
    $user = User::factory()->create(['email' => 'jeanne@exemple.fr']);

    $jeton = $this->postJson('/api/v1/auth/token', connexionMobile())
        ->assertCreated()
        ->assertJsonPath('data.two_factor', false)
        ->json('data.token');

    $enregistre = PersonalAccessToken::findToken($jeton);

    expect($enregistre?->abilities)->toBe(['mobile'])
        ->and($enregistre?->expires_at?->greaterThan(now()->addDays(29)))->toBeTrue();
    $this->withToken($jeton)->getJson('/api/v1/me')->assertOk()->assertJsonPath('data.id', $user->id);
});

it('répond le même 422 pour un mauvais mot de passe et un compte inconnu', function (): void {
    User::factory()->create(['email' => 'jeanne@exemple.fr']);

    $mauvais = $this->postJson('/api/v1/auth/token', connexionMobile(['password' => 'faux']))->assertUnprocessable();
    $inconnu = $this->postJson('/api/v1/auth/token', connexionMobile(['email' => 'inconnu@exemple.fr']))->assertUnprocessable();

    expect($mauvais->json('errors'))->toBe($inconnu->json('errors'));
});

it('bloque la 6e tentative', function (): void {
    for ($i = 0; $i < 5; $i++) {
        $this->postJson('/api/v1/auth/token', connexionMobile(['password' => 'faux']))->assertUnprocessable();
    }

    $this->postJson('/api/v1/auth/token', connexionMobile(['password' => 'faux']))->assertTooManyRequests();
});

it('refuse un nom d\'appareil vide, trop long ou avec des caractères de contrôle', function (string $nom): void {
    User::factory()->create(['email' => 'jeanne@exemple.fr']);

    $this->postJson('/api/v1/auth/token', connexionMobile(['device_name' => $nom]))->assertUnprocessable()->assertJsonValidationErrors('device_name');
})->with(['', str_repeat('a', 101), "iPh\x00one", "ligne\nnouvelle"]);

it('révoque le jeton courant à la déconnexion', function (): void {
    User::factory()->create(['email' => 'jeanne@exemple.fr']);
    $jeton = $this->postJson('/api/v1/auth/token', connexionMobile())->json('data.token');

    $this->withToken($jeton)->deleteJson('/api/v1/auth/token')->assertNoContent();
    auth()->forgetGuards();

    $this->withToken($jeton)->getJson('/api/v1/me')->assertUnauthorized();
});

it('renvoie un défi au lieu d\'un jeton quand la 2FA est active, puis délivre le jeton avec un bon code', function (): void {
    $user = User::factory()->create(['email' => 'jeanne@exemple.fr']);
    $secret = activerDeuxFacteurs($user);

    $reponse = $this->postJson('/api/v1/auth/token', connexionMobile())
        ->assertCreated()
        ->assertJsonPath('data.two_factor', true)
        ->assertJsonMissingPath('data.token');
    $defi = (string) $reponse->json('data.challenge');

    $this->postJson('/api/v1/auth/token/two-factor', ['challenge' => $defi, 'code' => '000000'])->assertUnprocessable();

    $jeton = $this->postJson('/api/v1/auth/token/two-factor', ['challenge' => $defi, 'code' => codeTotp($secret)])
        ->assertCreated()
        ->json('data.token');

    expect(PersonalAccessToken::findToken($jeton)?->abilities)->toBe(['mobile']);
});

it('refuse un défi rejoué', function (): void {
    $user = User::factory()->create(['email' => 'jeanne@exemple.fr']);
    activerDeuxFacteurs($user);
    $defi = $this->postJson('/api/v1/auth/token', connexionMobile())->json('data.challenge');

    $this->postJson('/api/v1/auth/token/two-factor', ['challenge' => $defi, 'recovery_code' => 'code-secours-1'])->assertCreated();
    $this->postJson('/api/v1/auth/token/two-factor', ['challenge' => $defi, 'recovery_code' => 'code-secours-2'])->assertUnprocessable();
});

it('invalide le défi après 5 codes faux', function (): void {
    $user = User::factory()->create(['email' => 'jeanne@exemple.fr']);
    $secret = activerDeuxFacteurs($user);
    $defi = (string) $this->postJson('/api/v1/auth/token', connexionMobile())->json('data.challenge');
    $defis = app(TwoFactorChallenges::class);

    for ($i = 0; $i < TwoFactorChallenges::ESSAIS_MAX; $i++) {
        $defis->recordFailure($defi);
    }

    $this->postJson('/api/v1/auth/token/two-factor', ['challenge' => $defi, 'code' => codeTotp($secret)])->assertUnprocessable();
});

it('fait expirer le défi au bout de 5 minutes', function (): void {
    $user = User::factory()->create(['email' => 'jeanne@exemple.fr']);
    $secret = activerDeuxFacteurs($user);
    $defi = $this->postJson('/api/v1/auth/token', connexionMobile())->json('data.challenge');

    $this->travel(6)->minutes();

    $this->postJson('/api/v1/auth/token/two-factor', ['challenge' => $defi, 'code' => codeTotp($secret)])->assertUnprocessable();
});

it('prévient d\'un nouvel appareil mais pas d\'un appareil connu', function (): void {
    $user = User::factory()->create(['email' => 'jeanne@exemple.fr']);

    $this->postJson('/api/v1/auth/token', connexionMobile())->assertCreated();
    $this->postJson('/api/v1/auth/token', connexionMobile())->assertCreated();
    Notification::assertNothingSent();

    $this->postJson('/api/v1/auth/token', connexionMobile(['device_name' => 'Pixel']))->assertCreated();
    Notification::assertSentToTimes($user, NewDeviceLoginNotification::class, 1);
});

it('liste les appareils de l\'utilisateur et révoque l\'un d\'eux', function (): void {
    $user = User::factory()->create();
    $courant = $user->createToken('iPhone', ['mobile']);
    $autre = $user->createToken('Pixel', ['mobile']);

    $this->withToken($courant->plainTextToken)
        ->getJson('/api/v1/me/devices')
        ->assertOk()
        ->assertJsonCount(2, 'data')
        ->assertJsonPath('data.1.current', true)
        ->assertJsonMissingPath('data.0.token');

    $this->withToken($courant->plainTextToken)->deleteJson('/api/v1/me/devices/'.$autre->accessToken->id)->assertNoContent();

    expect(PersonalAccessToken::query()->find($autre->accessToken->id))->toBeNull();
});

it('renvoie 404 pour l\'appareil d\'un autre utilisateur', function (): void {
    $user = User::factory()->create();
    $autre = User::factory()->create()->createToken('Pixel', ['mobile']);

    $this->withToken($user->createToken('iPhone', ['mobile'])->plainTextToken)
        ->deleteJson('/api/v1/me/devices/'.$autre->accessToken->id)
        ->assertNotFound();

    expect(PersonalAccessToken::query()->find($autre->accessToken->id))->not->toBeNull();
});

it('protège les routes appareils par authentification', function (): void {
    $this->getJson('/api/v1/me/devices')->assertUnauthorized();
    $this->deleteJson('/api/v1/me/devices/01934f6e-0000-7000-8000-000000000001')->assertUnauthorized();
    $this->deleteJson('/api/v1/me/devices/1')->assertNotFound();
    $this->deleteJson('/api/v1/auth/token')->assertUnauthorized();
});
