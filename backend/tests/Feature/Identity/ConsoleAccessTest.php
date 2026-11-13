<?php

declare(strict_types=1);

use App\Modules\Identity\Models\PersonalAccessToken;
use App\Modules\Identity\Models\User;
use App\Shared\Audit\AuditLog;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\Notification;

beforeEach(function (): void {
    Notification::fake();
});

function operateur(bool $deuxFacteurs = true): array
{
    $user = User::factory()->create(['email' => 'ops@exemple.fr']);
    $user->operator()->create(['granted_at' => now()]);
    $secret = $deuxFacteurs ? activerDeuxFacteurs($user) : '';

    return [$user, $secret];
}

it('délivre un jeton console avec e-mail, mot de passe et TOTP', function (): void {
    [$user, $secret] = operateur();

    $jeton = $this->postJson('/api/v1/console/auth/token', ['email' => 'ops@exemple.fr', 'password' => 'password', 'code' => codeTotp($secret)])
        ->assertCreated()
        ->json('data.token');

    $enregistre = PersonalAccessToken::findToken($jeton);

    expect($enregistre?->abilities)->toBe(['operator'])
        ->and($enregistre?->expires_at?->lessThanOrEqualTo(now()->addMinutes(240)))->toBeTrue()
        ->and(AuditLog::query()->where('action', 'auth.token.issued')->where('actor_user_id', $user->id)->exists())->toBeTrue();

    $this->withToken($jeton)->getJson('/api/v1/console/me')->assertOk()->assertJsonPath('data.id', $user->id);
});

it('refuse le jeton console avec la même réponse : TOTP faux, non-opérateur, compte inconnu, sans 2FA', function (): void {
    [, $secret] = operateur();
    User::factory()->create(['email' => 'simple@exemple.fr']);
    $sansDeuxFacteurs = User::factory()->create(['email' => 'ops2@exemple.fr']);
    $sansDeuxFacteurs->operator()->create(['granted_at' => now()]);

    $reponses = [
        $this->postJson('/api/v1/console/auth/token', ['email' => 'ops@exemple.fr', 'password' => 'password', 'code' => '000000']),
        $this->postJson('/api/v1/console/auth/token', ['email' => 'simple@exemple.fr', 'password' => 'password', 'code' => codeTotp($secret)]),
        $this->postJson('/api/v1/console/auth/token', ['email' => 'inconnu@exemple.fr', 'password' => 'password', 'code' => '123456']),
        $this->postJson('/api/v1/console/auth/token', ['email' => 'ops2@exemple.fr', 'password' => 'password', 'code' => '123456']),
    ];

    foreach ($reponses as $reponse) {
        $reponse->assertUnprocessable();
        expect(Arr::except($reponse->json(), 'request_id'))->toBe(Arr::except($reponses[0]->json(), 'request_id'));
    }

    expect(PersonalAccessToken::query()->count())->toBe(0);
});

it('exige un code TOTP ou un code de secours', function (): void {
    operateur();

    $this->postJson('/api/v1/console/auth/token', ['email' => 'ops@exemple.fr', 'password' => 'password'])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('code');
});

it('refuse /console sans authentification', function (): void {
    $this->getJson('/api/v1/console/me')->assertUnauthorized();
});

it('refuse /console à un opérateur connecté par session cookie', function (): void {
    [$user] = operateur();

    $this->actingAs($user, 'web')
        ->withHeader('Referer', 'http://localhost:3000/')
        ->getJson('/api/v1/console/me')
        ->assertForbidden()
        ->assertJsonPath('code', 'operator_token_required');
});

it('refuse /console avec un jeton mobile, même d\'un opérateur', function (): void {
    [$user] = operateur();

    $this->withToken($user->createToken('mobile', ['mobile'])->plainTextToken)
        ->getJson('/api/v1/console/me')
        ->assertForbidden()
        ->assertJsonPath('code', 'operator_token_required');
});

it('refuse /console à un jeton à toutes capacités', function (): void {
    [$user] = operateur();

    $this->withToken($user->createToken('test')->plainTextToken)->getJson('/api/v1/console/me')->assertForbidden();
});

it('refuse /console à un jeton opérateur dont le rôle est retiré', function (): void {
    [$user] = operateur();
    $jeton = $user->createToken('console', ['operator'])->plainTextToken;
    $user->operator()->update(['revoked_at' => now()]);

    $this->withToken($jeton)->getJson('/api/v1/console/me')->assertForbidden();
});

it('refuse un jeton console expiré', function (): void {
    [, $secret] = operateur();
    $jeton = $this->postJson('/api/v1/console/auth/token', ['email' => 'ops@exemple.fr', 'password' => 'password', 'code' => codeTotp($secret)])->json('data.token');

    $this->travel(241)->minutes();

    $this->withToken($jeton)->getJson('/api/v1/console/me')->assertUnauthorized();
});

it('révoque le jeton console', function (): void {
    [, $secret] = operateur();
    $jeton = $this->postJson('/api/v1/console/auth/token', ['email' => 'ops@exemple.fr', 'password' => 'password', 'code' => codeTotp($secret)])->json('data.token');

    $this->withToken($jeton)->deleteJson('/api/v1/console/auth/token')->assertNoContent();
    auth()->forgetGuards();

    $this->withToken($jeton)->getJson('/api/v1/console/me')->assertUnauthorized();
});

it('ne délivre jamais la capacité operator par l\'endpoint mobile', function (): void {
    operateur(deuxFacteurs: false);

    $jeton = $this->postJson('/api/v1/auth/token', ['email' => 'ops@exemple.fr', 'password' => 'password', 'device_name' => 'iPhone'])->json('data.token');

    $this->withToken($jeton)->getJson('/api/v1/console/me')->assertForbidden();
});
