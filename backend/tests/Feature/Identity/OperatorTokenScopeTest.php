<?php

declare(strict_types=1);

use App\Modules\Identity\Data\ProfileData;
use App\Modules\Identity\Enums\Space;
use App\Modules\Identity\Models\User;
use App\Modules\Identity\PublicApi\ProfileRegistry;
use Illuminate\Support\Facades\Route;

function jetonOperateur(User $user): string
{
    $user->operator()->create(['granted_at' => now()]);
    activerDeuxFacteurs($user);

    return $user->createToken('console', ['operator'])->plainTextToken;
}

it('refuse /me/security à un jeton opérateur', function (): void {
    $user = User::factory()->create();

    $this->withToken(jetonOperateur($user))->getJson('/api/v1/me/security')
        ->assertForbidden()
        ->assertJsonPath('code', 'operator_token_forbidden');
});

it('refuse tout le groupe /me à un jeton opérateur', function (): void {
    $jeton = jetonOperateur(User::factory()->create());

    foreach (['/me', '/me/profiles', '/me/devices'] as $chemin) {
        auth()->forgetGuards();
        $this->withToken($jeton)->getJson("/api/v1{$chemin}")->assertForbidden()->assertJsonPath('code', 'operator_token_forbidden');
    }
});

it('ouvre /me/security à un jeton mobile du même opérateur', function (): void {
    $user = User::factory()->create();
    jetonOperateur($user);

    $this->withToken($user->createToken('iPhone', ['mobile'])->plainTextToken)->getJson('/api/v1/me/security')->assertOk();
});

it('refuse un espace non console à un jeton opérateur, même avec le profil', function (): void {
    Route::middleware(['api', 'auth:sanctum', 'space:tenant'])->get('/api/v1/tenant/sonde-operateur', fn (): array => ['ok' => true]);
    $user = User::factory()->create();
    app(ProfileRegistry::class)->register(
        fn (string $id): array => $id === $user->id ? [new ProfileData(Space::Tenant, 'Locataire', [])] : [],
    );

    $this->withToken(jetonOperateur($user))->getJson('/api/v1/tenant/sonde-operateur')
        ->assertForbidden()
        ->assertJsonPath('code', 'operator_token_forbidden');

    auth()->forgetGuards();
    $this->withToken($user->createToken('iPhone', ['mobile'])->plainTextToken)->getJson('/api/v1/tenant/sonde-operateur')->assertOk();
});

it('refuse le guichet support, la création d’organisation et l’acceptation d’invitation à un jeton opérateur', function (): void {
    $jeton = jetonOperateur(User::factory()->create());

    foreach ([['get', '/support/tickets'], ['post', '/support/tickets'], ['post', '/organizations'], ['post', '/invitations/acceptance']] as [$methode, $chemin]) {
        auth()->forgetGuards();
        $this->withToken($jeton)->json($methode, "/api/v1{$chemin}")->assertForbidden()->assertJsonPath('code', 'operator_token_forbidden');
    }
});
