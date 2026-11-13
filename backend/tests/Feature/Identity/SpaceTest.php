<?php

declare(strict_types=1);

use App\Modules\Identity\Data\ProfileData;
use App\Modules\Identity\Enums\Space;
use App\Modules\Identity\Models\User;
use App\Modules\Identity\PublicApi\ProfileRegistry;
use Illuminate\Support\Facades\Route;

beforeEach(function (): void {
    Route::middleware(['api', 'auth:sanctum', 'space:tenant'])->get('/api/v1/tenant/sonde', fn (): array => ['ok' => true]);
});

function donnerProfilLocataire(string $userId): void
{
    app(ProfileRegistry::class)->register(
        fn (string $id): array => $id === $userId ? [new ProfileData(Space::Tenant, 'Locataire', ['leases' => 1])] : [],
    );
}

it('refuse un espace sans authentification', function (): void {
    $this->getJson('/api/v1/tenant/sonde')->assertUnauthorized();
});

it('refuse un espace à un compte non vérifié', function (): void {
    $user = User::factory()->unverified()->create();
    donnerProfilLocataire($user->id);

    $this->withToken($user->createToken('t', ['mobile'])->plainTextToken)
        ->getJson('/api/v1/tenant/sonde')
        ->assertForbidden()
        ->assertJsonPath('code', 'email_unverified');
});

it('refuse un espace sans le profil correspondant', function (): void {
    $user = User::factory()->create();

    $this->withToken($user->createToken('t', ['mobile'])->plainTextToken)
        ->getJson('/api/v1/tenant/sonde')
        ->assertForbidden()
        ->assertJsonPath('code', 'space_forbidden');
});

it('ouvre l\'espace au titulaire du profil, mais pas à un autre compte', function (): void {
    $titulaire = User::factory()->create();
    $autre = User::factory()->create();
    donnerProfilLocataire($titulaire->id);

    $this->withToken($titulaire->createToken('t', ['mobile'])->plainTextToken)->getJson('/api/v1/tenant/sonde')->assertOk();
    auth()->forgetGuards();
    $this->withToken($autre->createToken('t', ['mobile'])->plainTextToken)->getJson('/api/v1/tenant/sonde')->assertForbidden();
});

it('liste les profils de l\'utilisateur', function (): void {
    $user = User::factory()->create();
    $user->operator()->create(['granted_at' => now()]);
    donnerProfilLocataire($user->id);

    $this->withToken($user->createToken('t', ['mobile'])->plainTextToken)
        ->getJson('/api/v1/me/profiles')
        ->assertOk()
        ->assertJsonCount(2, 'data')
        ->assertJsonFragment(['space' => 'operator', 'label' => 'Console'])
        ->assertJsonFragment(['space' => 'tenant', 'label' => 'Locataire', 'meta' => ['leases' => 1]]);
});

it('renvoie une liste vide sans profil connu', function (): void {
    $user = User::factory()->create();

    $this->withToken($user->createToken('t', ['mobile'])->plainTextToken)
        ->getJson('/api/v1/me/profiles')
        ->assertOk()
        ->assertExactJson(['data' => []]);
});

it('refuse /me/profiles sans authentification', function (): void {
    $this->getJson('/api/v1/me/profiles')->assertUnauthorized();
});
