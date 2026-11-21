<?php

declare(strict_types=1);

use App\Modules\Identity\Http\Middleware\EnsureRecentReauthentication as Reauth;
use App\Modules\Identity\Models\User;
use Illuminate\Support\Facades\Route;

beforeEach(function (): void {
    Route::middleware(['web', 'auth:web', 'reauthenticated:two-factor'])->get('/_test/ecriture-2fa', fn () => response()->noContent());
    Route::middleware(['web', 'auth:web', 'reauthenticated'])->get('/_test/ecriture-souple', fn () => response()->noContent());
    Route::middleware(['api', 'auth:sanctum', 'reauthenticated:two-factor'])->get('/_test/ecriture-jeton', fn () => response()->noContent());
    Route::middleware(['web', 'auth:web', 'reauthenticated:inconnue'])->get('/_test/ecriture-inconnue', fn () => response()->noContent());
    $this->compte = User::factory()->create();
    $this->session = fn (array $cles) => $this->actingAs($this->compte, 'web')->withSession($cles);
});

it('refuse sans preuve, avec le seul mot de passe, et accepte une preuve 2FA récente', function (): void {
    ($this->session)([])->getJson('/_test/ecriture-2fa')->assertForbidden()->assertJsonPath('code', 'reauthentication_required');
    ($this->session)([Reauth::CLE_MOT_DE_PASSE => now()->getTimestamp()])->getJson('/_test/ecriture-2fa')->assertForbidden()->assertJsonPath('code', 'reauthentication_required');
    $this->flushSession();
    ($this->session)([Reauth::CLE_2FA => now()->getTimestamp()])->getJson('/_test/ecriture-2fa')->assertNoContent();
});

it('refuse une preuve 2FA vieille de plus de 10 minutes, accepte à 9 minutes 59', function (): void {
    ($this->session)([Reauth::CLE_2FA => now()->subMinutes(10)->subSecond()->getTimestamp()])->getJson('/_test/ecriture-2fa')->assertForbidden()->assertJsonPath('code', 'reauthentication_required');
    $this->flushSession();
    ($this->session)([Reauth::CLE_2FA => now()->subMinutes(9)->subSeconds(59)->getTimestamp()])->getJson('/_test/ecriture-2fa')->assertNoContent();
});

it('garde la variante par défaut qui accepte le mot de passe récent', function (): void {
    ($this->session)([Reauth::CLE_MOT_DE_PASSE => now()->getTimestamp()])->getJson('/_test/ecriture-souple')->assertNoContent();
    $this->flushSession();
    ($this->session)([])->getJson('/_test/ecriture-souple')->assertForbidden();
});

it('refuse à un jeton sans session toute écriture : la preuve repose sur la session web', function (): void {
    $jeton = $this->compte->createToken('mobile')->plainTextToken;

    $this->withToken($jeton)->getJson('/_test/ecriture-jeton')->assertForbidden()->assertJsonPath('code', 'reauthentication_required');
});

it('lève une erreur sur une variante inconnue plutôt que d\'affaiblir la garde', function (): void {
    ($this->session)([Reauth::CLE_2FA => now()->getTimestamp()])->getJson('/_test/ecriture-inconnue')->assertStatus(500);
});
